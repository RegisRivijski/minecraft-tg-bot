import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import config from '../../config/default.js';
import { postMoonChange, postToChannel, postWeatherChange } from './channelHelper.js';
import {
  dailyRecapText,
  emptyWorldText,
  moonPhaseText,
  onlineDigestText,
  tpsAlertText,
  tpsRecoveredText,
  weatherChangedText,
  weeklyRecapText,
  worldSpecialText,
} from './copyHelper.js';
import { describeWeather, isNotableMoonPhase, parsePlayerList } from './minecraftHelper.js';
import { fetchMoon, fetchTime, queryPresent, queryTps, queryWeather } from './serverHelper.js';
import {
  markOnlineDigestPosted,
  shouldPostOnlineDigest,
  takeDailyRecap,
  takeEmptyWorldAnnouncement,
  takeMoonAnnouncement,
  takeWeeklyRecap,
  zonedParts,
} from './worldStatsHelper.js';

export function startChannelWatchers(telegram) {
  const stopWeather = startWeatherWatcher(telegram);
  const stopDigest = startOnlineDigest(telegram);
  const stopTps = startTpsWatcher(telegram);
  const stopMoon = startMoonWatcher(telegram);
  const stopWorldEvents = startWorldEventWatcher(telegram);
  const stopSchedule = startScheduleWatcher(telegram);
  return () => {
    stopWeather();
    stopDigest();
    stopTps();
    stopMoon();
    stopWorldEvents();
    stopSchedule();
  };
}

function startWeatherWatcher(telegram) {
  let previousKey = null;
  let timer = null;
  let inFlight = false;

  const pollWeather = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const weather = await queryWeather();
      if (!weather?.key) {
        return;
      }
      if (previousKey == null) {
        previousKey = weather.key;
        return;
      }
      if (previousKey === weather.key) {
        return;
      }
      const previous = describeWeather(previousKey);
      previousKey = weather.key;
      const [{ daytime }, listRaw] = await Promise.all([
        fetchTime(),
        rconSend('list'),
      ]);
      console.info(`[weather] ${previous?.key || '—'} → ${weather.key}`);
      await postWeatherChange(
        telegram,
        weatherChangedText(previous, weather, daytime, parsePlayerList(listRaw)),
        weather.key,
        daytime,
      );
    } catch (err) {
      console.warn('[weather]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(pollWeather, config.server.weatherPollMs);
  pollWeather();
  console.info(`[weather] polling every ${config.server.weatherPollMs}ms`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function startOnlineDigest(telegram) {
  let timer = null;
  let inFlight = false;

  const postDigest = async () => {
    if (inFlight || !shouldPostOnlineDigest()) {
      return;
    }
    inFlight = true;
    try {
      const [listRaw, { daytime }, weather] = await Promise.all([
        rconSend('list'),
        fetchTime(),
        queryWeather(),
      ]);
      const list = parsePlayerList(listRaw);
      if (!list.ok || !list.players.length) {
        return;
      }
      console.info(`[digest] ${list.online} online`);
      await postToChannel(telegram, onlineDigestText({ list, daytime, weather }));
      markOnlineDigestPosted();
    } catch (err) {
      console.warn('[digest]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(postDigest, config.server.recapPollMs);
  postDigest();
  console.info(`[digest] once per clock hour (${config.server.timeZone}), persists across restarts`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function startTpsWatcher(telegram) {
  let lagging = null;
  let timer = null;
  let inFlight = false;

  const pollTps = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const tps = await queryTps();
      if (tps == null) {
        return;
      }
      if (lagging == null) {
        lagging = tps < config.server.tpsAlertBelow;
        return;
      }
      if (!lagging && tps < config.server.tpsAlertBelow) {
        lagging = true;
        console.info(`[tps] alert ${tps.toFixed(1)}`);
        await postToChannel(telegram, tpsAlertText(tps));
        return;
      }
      if (lagging && tps >= config.server.tpsRecoverAt) {
        lagging = false;
        console.info(`[tps] recovered ${tps.toFixed(1)}`);
        await postToChannel(telegram, tpsRecoveredText(tps));
      }
    } catch (err) {
      console.warn('[tps]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(pollTps, config.server.tpsPollMs);
  pollTps();
  console.info(`[tps] alert below ${config.server.tpsAlertBelow}, recover at ${config.server.tpsRecoverAt}`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function startMoonWatcher(telegram) {
  let timer = null;
  let inFlight = false;

  const pollMoon = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const moon = await fetchMoon();
      if (!await takeMoonAnnouncement(moon, isNotableMoonPhase(moon))) {
        return;
      }
      const [{ daytime }, listRaw] = await Promise.all([
        fetchTime(),
        rconSend('list'),
      ]);
      console.info(`[moon] ${moon.key} day=${moon.day}`);
      await postMoonChange(
        telegram,
        moonPhaseText(moon, daytime, parsePlayerList(listRaw)),
        moon.key,
      );
    } catch (err) {
      console.warn('[moon]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(pollMoon, config.server.moonPollMs);
  pollMoon();
  console.info(`[moon] polling every ${config.server.moonPollMs}ms`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const WORLD_EVENTS = [
  {
    key: 'raid',
    commands: [
      'execute as @e[type=#minecraft:raiders,limit=1] if data entity @s RaidId',
      'execute if entity @e[type=minecraft:ravager,limit=1]',
    ],
  },
  {
    key: 'dragon',
    commands: ['execute if entity @e[type=minecraft:ender_dragon,limit=1]'],
  },
  {
    key: 'wither',
    commands: ['execute if entity @e[type=minecraft:wither,limit=1]'],
  },
  {
    key: 'warden',
    commands: ['execute if entity @e[type=minecraft:warden,limit=1]'],
  },
];

function startWorldEventWatcher(telegram) {
  const seen = Object.fromEntries(WORLD_EVENTS.map((event) => [event.key, null]));
  const goneStreak = Object.fromEntries(WORLD_EVENTS.map((event) => [event.key, 0]));
  let timer = null;
  let inFlight = false;

  const pollWorldEvents = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      for (const event of WORLD_EVENTS) {
        const present = await queryPresent(event.commands);
        if (present == null) {
          continue;
        }
        if (seen[event.key] == null) {
          seen[event.key] = present;
          continue;
        }
        if (present) {
          goneStreak[event.key] = 0;
          if (!seen[event.key]) {
            seen[event.key] = true;
            console.info(`[world] ${event.key} started`);
            await postToChannel(telegram, worldSpecialText(event.key, true));
          }
          continue;
        }
        if (seen[event.key]) {
          goneStreak[event.key] += 1;
          if (goneStreak[event.key] < 2) {
            continue;
          }
          seen[event.key] = false;
          goneStreak[event.key] = 0;
          console.info(`[world] ${event.key} ended`);
          await postToChannel(telegram, worldSpecialText(event.key, false));
        }
      }
    } catch (err) {
      console.warn('[world]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(pollWorldEvents, config.server.worldEventPollMs);
  pollWorldEvents();
  console.info(`[world] polling raid/dragon/wither/warden every ${config.server.worldEventPollMs}ms`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function startScheduleWatcher(telegram) {
  let timer = null;
  let inFlight = false;

  const pollSchedule = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const empty = takeEmptyWorldAnnouncement();
      if (empty) {
        console.info(`[empty] ${empty.days ? `${empty.days}d` : `${empty.hours}h`}`);
        await postToChannel(telegram, emptyWorldText(empty));
      }

      const parts = zonedParts();
      const daily = takeDailyRecap(parts);
      if (daily) {
        console.info(`[recap] daily players=${daily.players.length} deaths=${daily.deaths}`);
        await postToChannel(telegram, dailyRecapText(daily));
      }

      const weekly = takeWeeklyRecap(parts);
      if (weekly) {
        console.info(`[recap] weekly play=${weekly.playTop.length} deaths=${weekly.deathTop.length}`);
        await postToChannel(telegram, weeklyRecapText(weekly));
      }
    } catch (err) {
      console.warn('[schedule]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(pollSchedule, config.server.recapPollMs);
  pollSchedule();
  console.info(`[schedule] daily ${config.server.dailyRecapHour}:00 ${config.server.timeZone}, empty at ${config.server.emptyWorldHours.join('/')}h then daily`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

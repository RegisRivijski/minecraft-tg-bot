import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import config from '../../config/default.js';
import { postToChannel, postWeatherChange } from './channelHelper.js';
import {
  dailyRecapText,
  emptyWorldText,
  moonPhaseText,
  onlineDigestText,
  tpsAlertText,
  tpsRecoveredText,
  weatherChangedText,
  weeklyRecapText,
} from './copyHelper.js';
import { describeWeather, isNotableMoonPhase, parsePlayerList } from './minecraftHelper.js';
import { fetchMoon, fetchTime, queryTps, queryWeather } from './serverHelper.js';
import {
  takeDailyRecap,
  takeEmptyWorldAnnouncement,
  takeWeeklyRecap,
  zonedParts,
} from './worldStatsHelper.js';

export function startChannelWatchers(telegram) {
  const stopWeather = startWeatherWatcher(telegram);
  const stopDigest = startOnlineDigest(telegram);
  const stopTps = startTpsWatcher(telegram);
  const stopMoon = startMoonWatcher(telegram);
  const stopSchedule = startScheduleWatcher(telegram);
  return () => {
    stopWeather();
    stopDigest();
    stopTps();
    stopMoon();
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
      const { daytime } = await fetchTime();
      console.info(`[weather] ${previous?.key || '—'} → ${weather.key}`);
      await postWeatherChange(telegram, weatherChangedText(previous, weather, daytime), weather.key);
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
    if (inFlight) {
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
    } catch (err) {
      console.warn('[digest]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(postDigest, config.server.digestIntervalMs);
  console.info(`[digest] every ${config.server.digestIntervalMs}ms if players are online`);

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
  let previousKey = null;
  let timer = null;
  let inFlight = false;

  const pollMoon = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const moon = await fetchMoon();
      if (!moon?.key) {
        return;
      }
      if (previousKey == null) {
        previousKey = moon.key;
        return;
      }
      if (previousKey === moon.key) {
        return;
      }
      previousKey = moon.key;
      if (!isNotableMoonPhase(moon)) {
        return;
      }
      console.info(`[moon] ${moon.key}`);
      await postToChannel(telegram, moonPhaseText(moon));
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
        console.info(`[empty] world empty for ${empty.hours}h`);
        await postToChannel(telegram, emptyWorldText(empty));
      }

      const parts = zonedParts();
      const daily = takeDailyRecap(parts);
      if (daily) {
        const moon = await fetchMoon().catch(() => null);
        console.info(`[recap] daily players=${daily.players.length} deaths=${daily.deaths}`);
        await postToChannel(telegram, dailyRecapText({ ...daily, moon }));
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
  console.info(`[schedule] daily ${config.server.dailyRecapHour}:00 ${config.server.timeZone}, empty after ${config.server.emptyWorldMs}ms`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

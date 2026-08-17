import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import config from '../../config/default.js';
import { postToChannel } from './channelHelper.js';
import { onlineDigestText, weatherChangedText } from './copyHelper.js';
import { describeWeather, parsePlayerList } from './minecraftHelper.js';
import { fetchTime, queryWeather } from './serverHelper.js';

export function startChannelWatchers(telegram) {
  const stopWeather = startWeatherWatcher(telegram);
  const stopDigest = startOnlineDigest(telegram);
  return () => {
    stopWeather();
    stopDigest();
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
      console.info(`[weather] ${previous?.key || '—'} → ${weather.key}`);
      await postToChannel(telegram, weatherChangedText(previous, weather));
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

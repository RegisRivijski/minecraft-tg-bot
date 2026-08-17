import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import {
  describeDaytime,
  describeMoonPhase,
  describeWeather,
  normalizeDayTicks,
  parseDifficulty,
  parsePlayerList,
  parseTimeQuery,
  parseTps,
  parseWeatherCheck,
  parseWeatherQuery,
  TICKS_PER_DAY,
} from './minecraftHelper.js';

async function queryDaytimeTicks() {
  for (const command of ['time query time', 'time query daytime']) {
    const ticks = parseTimeQuery(await rconSend(command).catch(() => ''));
    if (ticks == null) {
      continue;
    }
    return normalizeDayTicks(ticks);
  }

  const gametime = parseTimeQuery(await rconSend('time query gametime').catch(() => ''));
  if (gametime == null) {
    return null;
  }
  return normalizeDayTicks(gametime);
}

const WEATHER_CHECKS = [
  (flag) => `execute in minecraft:overworld if predicate {"condition":"minecraft:weather_check","${flag}":true}`,
  (flag) => `execute in minecraft:overworld if predicate {condition:"minecraft:weather_check",${flag}:true}`,
];

async function checkWeatherFlag(flag) {
  let lastRaw = '';
  for (const buildCommand of WEATHER_CHECKS) {
    lastRaw = await rconSend(buildCommand(flag)).catch(() => '');
    const result = parseWeatherCheck(lastRaw);
    if (result !== null) {
      return { result, raw: lastRaw };
    }
  }
  return { result: null, raw: lastRaw };
}

export async function queryWeather() {
  const [queryRaw, thunder, rain] = await Promise.all([
    rconSend('weather query').catch(() => ''),
    checkWeatherFlag('thundering'),
    checkWeatherFlag('raining'),
  ]);

  const fromQuery = parseWeatherQuery(queryRaw);
  if (fromQuery) {
    return describeWeather(fromQuery);
  }

  if (thunder.result) {
    return describeWeather('thunder');
  }
  if (rain.result) {
    return describeWeather('rain');
  }
  if (thunder.result === false && rain.result === false) {
    return describeWeather('clear');
  }

  console.warn('[weather] unread', {
    query: String(queryRaw).slice(0, 200),
    thunder: String(thunder.raw).slice(0, 200),
    rain: String(rain.raw).slice(0, 200),
  });
  return null;
}

export async function fetchServer() {
  const [listRaw, daytimeTicks, weather, difficultyRaw, tpsRaw] = await Promise.all([
    rconSend('list'),
    queryDaytimeTicks(),
    queryWeather(),
    rconSend('difficulty').catch(() => ''),
    rconSend('tps').catch(() => ''),
  ]);

  return {
    list: parsePlayerList(listRaw),
    daytime: describeDaytime(daytimeTicks),
    weather,
    difficulty: parseDifficulty(difficultyRaw),
    tps: parseTps(tpsRaw),
  };
}

export async function fetchTime() {
  return {
    daytime: describeDaytime(await queryDaytimeTicks()),
  };
}

export async function queryTps() {
  return parseTps(await rconSend('tps').catch(() => ''));
}

function moonDayNumber(dayQuery, gametime) {
  const fromGame = gametime == null ? null : Math.floor(gametime / TICKS_PER_DAY);
  if (dayQuery == null) {
    return fromGame;
  }
  // `time query day` must be a day count. Some servers echo ticks instead.
  if (dayQuery >= TICKS_PER_DAY) {
    const fromTicks = Math.floor(dayQuery / TICKS_PER_DAY);
    if (fromGame == null || Math.abs(fromTicks - fromGame) <= 1) {
      return fromTicks;
    }
    return fromGame;
  }
  return dayQuery;
}

export async function fetchMoon() {
  const [dayRaw, gameRaw] = await Promise.all([
    rconSend('time query day').catch(() => ''),
    rconSend('time query gametime').catch(() => ''),
  ]);
  return describeMoonPhase(moonDayNumber(parseTimeQuery(dayRaw), parseTimeQuery(gameRaw)));
}

export async function queryPresent(commands) {
  for (const command of commands) {
    const raw = await rconSend(command).catch(() => '');
    const result = parseWeatherCheck(raw);
    if (result === true) {
      return true;
    }
    if (result === false) {
      return false;
    }
  }
  return null;
}

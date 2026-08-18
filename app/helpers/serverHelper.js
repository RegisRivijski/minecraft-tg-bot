import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import {
  describeDaytime,
  describeMoonPhase,
  describeWeather,
  normalizeDayTicks,
  parseDifficulty,
  parseGamerule,
  parsePlayerList,
  parseSeed,
  parseTimeQuery,
  parseTps,
  parseTpsWindows,
  parseWeatherCheck,
  parseWeatherQuery,
  parseWhitelistList,
  TICKS_PER_DAY,
} from './minecraftHelper.js';
import { ownerWorldStats } from './worldStatsHelper.js';

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
  const [
    listRaw,
    daytimeTicks,
    weather,
    difficultyRaw,
    tpsRaw,
    seedRaw,
    moon,
    whitelistRaw,
    gamerules,
  ] = await Promise.all([
    rconSend('list'),
    queryDaytimeTicks(),
    queryWeather(),
    rconSend('difficulty').catch(() => ''),
    rconSend('tps').catch(() => ''),
    rconSend('seed').catch(() => ''),
    fetchMoon().catch(() => null),
    rconSend('whitelist list').catch(() => ''),
    queryGamerules().catch(() => ({})),
  ]);

  const tpsWindows = parseTpsWindows(tpsRaw);
  return {
    list: parsePlayerList(listRaw),
    daytime: describeDaytime(daytimeTicks),
    weather,
    difficulty: parseDifficulty(difficultyRaw),
    tps: tpsWindows?.current ?? null,
    tpsWindows: tpsWindows?.windows || null,
    seed: parseSeed(seedRaw),
    moon,
    whitelist: parseWhitelistList(whitelistRaw),
    gamerules,
    stats: ownerWorldStats(),
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

export async function fetchMoon() {
  const gametime = parseTimeQuery(await rconSend('time query gametime').catch(() => ''));
  if (gametime == null) {
    return null;
  }
  return describeMoonPhase(Math.floor(gametime / TICKS_PER_DAY));
}

const OWNER_GAMERULES = [
  'keepInventory',
  'mobGriefing',
  'doMobSpawning',
  'doDaylightCycle',
  'doWeatherCycle',
  'playersSleepingPercentage',
  'doImmediateRespawn',
];

async function queryGamerules() {
  const entries = await Promise.all(OWNER_GAMERULES.map(async (name) => {
    const raw = await rconSend(`gamerule ${name}`).catch(() => '');
    return [name, parseGamerule(raw)];
  }));
  return Object.fromEntries(entries);
}

import config from '../../config/default.js';
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
import { recentPlayerList } from './playerWatcherHelper.js';
import { ownerWorldStats } from './worldStatsHelper.js';

let daytimeCommand = null;
let tpsCommand = null;
let cachedTpsRaw = '';
let lastTpsAt = 0;
let weatherQueryWorks = null;
let weatherCheckBuilder = null;

async function queryDaytimeTicks() {
  if (daytimeCommand) {
    const ticks = parseTimeQuery(await rconSend(daytimeCommand).catch(() => ''));
    if (ticks != null) {
      return normalizeDayTicks(ticks);
    }
    daytimeCommand = null;
  }
  for (const command of ['time query time', 'time query daytime', 'time query gametime']) {
    const ticks = parseTimeQuery(await rconSend(command).catch(() => ''));
    if (ticks == null) {
      continue;
    }
    daytimeCommand = command;
    return normalizeDayTicks(ticks);
  }
  return null;
}

const WEATHER_CHECKS = [
  (flag) => `execute in minecraft:overworld if predicate {"condition":"minecraft:weather_check","${flag}":true}`,
  (flag) => `execute in minecraft:overworld if predicate {condition:"minecraft:weather_check",${flag}:true}`,
];

async function checkWeatherFlag(flag) {
  const builders = weatherCheckBuilder ? [weatherCheckBuilder] : WEATHER_CHECKS;
  let lastRaw = '';
  for (const buildCommand of builders) {
    lastRaw = await rconSend(buildCommand(flag)).catch(() => '');
    const result = parseWeatherCheck(lastRaw);
    if (result !== null) {
      weatherCheckBuilder = buildCommand;
      return { result, raw: lastRaw };
    }
  }
  return { result: null, raw: lastRaw };
}

export async function queryWeather() {
  if (weatherQueryWorks !== false) {
    const fromQuery = parseWeatherQuery(await rconSend('weather query').catch(() => ''));
    if (fromQuery) {
      weatherQueryWorks = true;
      return describeWeather(fromQuery);
    }
    if (weatherQueryWorks === true) {
      return null;
    }
    weatherQueryWorks = false;
  }

  const [thunder, rain] = await Promise.all([
    checkWeatherFlag('thundering'),
    checkWeatherFlag('raining'),
  ]);

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
    thunder: String(thunder.raw).slice(0, 200),
    rain: String(rain.raw).slice(0, 200),
  });
  return null;
}

export async function fetchServer() {
  const [
    listRaw,
    clock,
    weather,
    difficultyRaw,
    tpsRaw,
    seedRaw,
    whitelistRaw,
    gamerules,
  ] = await Promise.all([
    rconSend('list'),
    fetchWorldClock(),
    queryWeather(),
    rconSend('difficulty').catch(() => ''),
    queryTpsRaw({ fresh: true }),
    rconSend('seed').catch(() => ''),
    rconSend('whitelist list').catch(() => ''),
    queryGamerules().catch(() => ({})),
  ]);

  const tpsWindows = parseTpsWindows(tpsRaw);
  return {
    list: parsePlayerList(listRaw),
    daytime: clock.daytime,
    weather,
    difficulty: parseDifficulty(difficultyRaw),
    tps: tpsWindows?.current ?? null,
    tpsWindows: tpsWindows?.windows || null,
    seed: parseSeed(seedRaw),
    moon: clock.moon,
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

export async function fetchWorldClock() {
  if (daytimeCommand === 'time query gametime') {
    const gametime = parseTimeQuery(await rconSend('time query gametime').catch(() => ''));
    return {
      daytime: describeDaytime(gametime == null ? null : normalizeDayTicks(gametime)),
      moon: gametime == null ? null : describeMoonPhase(Math.floor(gametime / TICKS_PER_DAY)),
    };
  }
  const [daytimeTicks, gametime] = await Promise.all([
    queryDaytimeTicks().catch(() => null),
    rconSend('time query gametime').catch(() => ''),
  ]);
  const ticks = parseTimeQuery(gametime);
  return {
    daytime: describeDaytime(daytimeTicks),
    moon: ticks == null ? null : describeMoonPhase(Math.floor(ticks / TICKS_PER_DAY)),
  };
}

export async function fetchWorldSnapshot() {
  const cachedList = recentPlayerList();
  const [listRaw, clock, weather, tps] = await Promise.all([
    cachedList ? Promise.resolve('') : rconSend('list').catch(() => ''),
    fetchWorldClock(),
    queryWeather().catch(() => null),
    queryTps().catch(() => null),
  ]);
  return {
    list: cachedList || parsePlayerList(listRaw),
    daytime: clock.daytime,
    weather,
    moon: clock.moon,
    tps,
  };
}

async function discoverTpsRaw() {
  if (tpsCommand) {
    const raw = await rconSend(tpsCommand).catch(() => '');
    if (parseTpsWindows(raw)) {
      return raw;
    }
    tpsCommand = null;
  }
  for (const command of ['spark tps', 'tps']) {
    const raw = await rconSend(command).catch(() => '');
    if (parseTpsWindows(raw)) {
      tpsCommand = command;
      return raw;
    }
  }
  return '';
}

async function queryTpsRaw({ fresh = false } = {}) {
  const now = Date.now();
  // Status board polls often; Spark TPS is the expensive RCON. /server always refreshes.
  if (!fresh && lastTpsAt && now - lastTpsAt < config.server.tpsPollMs) {
    return cachedTpsRaw;
  }

  const raw = await discoverTpsRaw();
  lastTpsAt = now;
  if (parseTpsWindows(raw)) {
    cachedTpsRaw = raw;
    return raw;
  }
  return cachedTpsRaw;
}

export async function queryTps() {
  return parseTps(await queryTpsRaw());
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

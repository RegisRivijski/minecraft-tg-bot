import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import {
  describeDaytime,
  describeWeather,
  parseDifficulty,
  parsePlayerList,
  parseTimeQuery,
  parseTps,
  parseWeatherCheck,
  parseWeatherQuery,
} from './minecraftHelper.js';

async function queryDaytimeTicks() {
  for (const command of ['time query time', 'time query daytime']) {
    const ticks = parseTimeQuery(await rconSend(command).catch(() => ''));
    if (ticks == null) {
      continue;
    }
    return ((ticks % 24000) + 24000) % 24000;
  }

  const gametime = parseTimeQuery(await rconSend('time query gametime').catch(() => ''));
  if (gametime == null) {
    return null;
  }
  return ((gametime % 24000) + 24000) % 24000;
}

const WEATHER_PREDICATE = (state) => (
  `execute in minecraft:overworld positioned 0 64 0 if predicate {condition:minecraft:weather_check,${state}}`
);

export async function queryWeather() {
  const [queryRaw, thunderRaw, rainRaw] = await Promise.all([
    rconSend('weather query').catch(() => ''),
    rconSend(WEATHER_PREDICATE('thundering:true')).catch(() => ''),
    rconSend(WEATHER_PREDICATE('raining:true')).catch(() => ''),
  ]);

  const fromQuery = parseWeatherQuery(queryRaw);
  if (fromQuery) {
    return describeWeather(fromQuery);
  }

  const thunder = parseWeatherCheck(thunderRaw);
  if (thunder) {
    return describeWeather('thunder');
  }
  const rain = parseWeatherCheck(rainRaw);
  if (rain) {
    return describeWeather('rain');
  }
  if (thunder === false && rain === false) {
    return describeWeather('clear');
  }
  return null;
}

export async function fetchServer() {
  const [listRaw, daytimeTicks, weather, difficultyRaw, tpsRaw] = await Promise.all([
    rconSend('list'),
    queryDaytimeTicks(),
    queryWeather(),
    rconSend('difficulty'),
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

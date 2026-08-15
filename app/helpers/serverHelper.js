import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import {
  describeDaytime,
  parseDifficulty,
  parsePlayerList,
  parseTimeQuery,
  parseTps,
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

export async function fetchServer() {
  const [listRaw, daytimeTicks, dayRaw, difficultyRaw, tpsRaw] = await Promise.all([
    rconSend('list'),
    queryDaytimeTicks(),
    rconSend('time query day'),
    rconSend('difficulty'),
    rconSend('tps').catch(() => ''),
  ]);

  return {
    list: parsePlayerList(listRaw),
    daytime: describeDaytime(daytimeTicks),
    worldDay: parseTimeQuery(dayRaw),
    difficulty: parseDifficulty(difficultyRaw),
    tps: parseTps(tpsRaw),
  };
}

export async function fetchTime() {
  const [daytimeTicks, dayRaw] = await Promise.all([
    queryDaytimeTicks(),
    rconSend('time query day'),
  ]);
  return {
    daytime: describeDaytime(daytimeTicks),
    worldDay: parseTimeQuery(dayRaw),
  };
}

import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import {
  describeDaytime,
  parseDifficulty,
  parsePlayerList,
  parseTimeQuery,
  parseTps,
} from './minecraftHelper.js';

export async function fetchServer() {
  const [listRaw, daytimeRaw, dayRaw, difficultyRaw, tpsRaw] = await Promise.all([
    rconSend('list'),
    rconSend('time query daytime'),
    rconSend('time query day'),
    rconSend('difficulty'),
    rconSend('tps').catch(() => ''),
  ]);

  return {
    list: parsePlayerList(listRaw),
    daytime: describeDaytime(parseTimeQuery(daytimeRaw)),
    worldDay: parseTimeQuery(dayRaw),
    difficulty: parseDifficulty(difficultyRaw),
    tps: parseTps(tpsRaw),
  };
}

export async function fetchTime() {
  const [daytimeRaw, dayRaw] = await Promise.all([
    rconSend('time query daytime'),
    rconSend('time query day'),
  ]);
  return {
    daytime: describeDaytime(parseTimeQuery(daytimeRaw)),
    worldDay: parseTimeQuery(dayRaw),
  };
}

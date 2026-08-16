import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { requireOwner } from '../helpers/accessHelper.js';
import {
  HTML,
  difficultyText,
  difficultyUsage,
  seedText,
  timeSetDone,
  timeSetUsage,
  timeText,
  weatherSetDone,
  weatherText,
  weatherUsage,
} from '../helpers/copyHelper.js';
import {
  commandArgs,
  parseDifficulty,
  parseSeed,
  timeSetLabel,
  weatherLabel,
} from '../helpers/minecraftHelper.js';
import { fetchTime, queryWeather } from '../helpers/serverHelper.js';

export async function time(ctx) {
  const timeArg = commandArgs(ctx).toLowerCase();
  if (!timeArg) {
    const { daytime } = await fetchTime();
    await ctx.reply(timeText(daytime), HTML);
    return;
  }
  if (!(await requireOwner(ctx))) {
    return;
  }

  const presetLabel = timeSetLabel(timeArg);
  const isTickCount = /^\d+$/.test(timeArg);
  if (!presetLabel && !isTickCount) {
    await ctx.reply(timeSetUsage(), HTML);
    return;
  }

  await rconSend(`time set ${timeArg}`);
  await ctx.reply(timeSetDone(presetLabel || timeArg), HTML);
}

export async function weather(ctx) {
  const weatherArg = commandArgs(ctx).toLowerCase();
  if (!weatherArg) {
    await ctx.reply(weatherText(await queryWeather()), HTML);
    return;
  }
  if (!(await requireOwner(ctx))) {
    return;
  }

  const presetLabel = weatherLabel(weatherArg);
  if (!presetLabel) {
    await ctx.reply(weatherUsage(), HTML);
    return;
  }

  await rconSend(`weather ${weatherArg}`);
  await ctx.reply(weatherSetDone(presetLabel), HTML);
}

export async function seed(ctx) {
  const worldSeed = parseSeed(await rconSend('seed'));
  await ctx.reply(seedText(worldSeed), HTML);
}

export async function difficulty(ctx) {
  const difficultyArg = commandArgs(ctx).toLowerCase();
  if (!difficultyArg) {
    const current = parseDifficulty(await rconSend('difficulty'));
    await ctx.reply(difficultyText(current), HTML);
    return;
  }
  if (!(await requireOwner(ctx))) {
    return;
  }
  if (!['peaceful', 'easy', 'normal', 'hard'].includes(difficultyArg)) {
    await ctx.reply(difficultyUsage(), HTML);
    return;
  }

  await rconSend(`difficulty ${difficultyArg}`);
  await ctx.reply(difficultyText(parseDifficulty(difficultyArg)), HTML);
}

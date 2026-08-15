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
  weatherUsage,
} from '../helpers/copyHelper.js';
import {
  commandArgs,
  parseDifficulty,
  parseSeed,
  timeSetLabel,
  weatherLabel,
} from '../helpers/minecraftHelper.js';
import { fetchTime } from '../helpers/serverHelper.js';

export async function time(ctx) {
  const args = commandArgs(ctx).toLowerCase();
  if (!args) {
    const { daytime, worldDay } = await fetchTime();
    await ctx.reply(timeText(daytime, worldDay), HTML);
    return;
  }
  if (!(await requireOwner(ctx))) {
    return;
  }

  const label = timeSetLabel(args);
  if (!label && !/^\d+$/.test(args)) {
    await ctx.reply(timeSetUsage(), HTML);
    return;
  }

  await rconSend(`time set ${args}`);
  await ctx.reply(timeSetDone(label || args), HTML);
}

export async function weather(ctx) {
  if (!(await requireOwner(ctx))) {
    return;
  }
  const args = commandArgs(ctx).toLowerCase();
  const label = weatherLabel(args);
  if (!label) {
    await ctx.reply(weatherUsage(), HTML);
    return;
  }
  await rconSend(`weather ${args}`);
  await ctx.reply(weatherSetDone(label), HTML);
}

export async function seed(ctx) {
  await ctx.reply(seedText(parseSeed(await rconSend('seed'))), HTML);
}

export async function difficulty(ctx) {
  const args = commandArgs(ctx).toLowerCase();
  if (!args) {
    await ctx.reply(difficultyText(parseDifficulty(await rconSend('difficulty'))), HTML);
    return;
  }
  if (!(await requireOwner(ctx))) {
    return;
  }
  if (!['peaceful', 'easy', 'normal', 'hard'].includes(args)) {
    await ctx.reply(difficultyUsage(), HTML);
    return;
  }
  await rconSend(`difficulty ${args}`);
  await ctx.reply(difficultyText(parseDifficulty(args)), HTML);
}

import { isOwnerCtx } from '../constants/access.js';
import { rconSend } from '../modules/rconClient.js';
import { isChatRelayEnabled, setChatRelay } from '../modules/chatRelay.js';
import {
  HTML,
  chatStatus,
  chatUsage,
  difficultyText,
  difficultyUsage,
  helpText,
  listText,
  loadingWorld,
  noPermission,
  rconEmpty,
  rconUsage,
  sayDone,
  sayUsage,
  seedText,
  serverMenu,
  timeSetDone,
  timeSetUsage,
  timeText,
  weatherSetDone,
  weatherUsage,
  whitelistUsage,
} from '../helpers/copy.js';
import {
  commandArgs,
  describeDaytime,
  escapeHtml,
  parseDifficulty,
  parsePlayerList,
  parseSeed,
  parseTimeQuery,
  parseTps,
  stripMcColor,
  timeSetLabel,
  weatherLabel,
} from '../helpers/minecraft.js';

async function fetchServer() {
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

async function fetchTime() {
  const [daytimeRaw, dayRaw] = await Promise.all([
    rconSend('time query daytime'),
    rconSend('time query day'),
  ]);
  return {
    daytime: describeDaytime(parseTimeQuery(daytimeRaw)),
    worldDay: parseTimeQuery(dayRaw),
  };
}

async function requireOwner(ctx) {
  if (isOwnerCtx(ctx)) {
    return true;
  }
  await ctx.reply(noPermission(), HTML);
  return false;
}

export function registerCommands(bot) {
  bot.start(async (ctx) => {
    await ctx.reply(loadingWorld(), HTML);
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(helpText(isOwnerCtx(ctx)), HTML);
  });

  bot.command('server', async (ctx) => {
    await ctx.reply(serverMenu(await fetchServer()), HTML);
  });

  bot.command(['list', 'online'], async (ctx) => {
    const list = parsePlayerList(await rconSend('list'));
    await ctx.reply(listText(list), HTML);
  });

  bot.command('chat', async (ctx) => {
    const args = commandArgs(ctx).toLowerCase();
    if (!args) {
      await ctx.reply(chatStatus(isChatRelayEnabled(ctx.chat.id)), HTML);
      return;
    }
    if (['on', 'вкл', 'enable'].includes(args)) {
      await setChatRelay(ctx.chat.id, true, ctx.chat.title);
      await ctx.reply(chatStatus(true), HTML);
      return;
    }
    if (['off', 'выкл', 'disable'].includes(args)) {
      await setChatRelay(ctx.chat.id, false, ctx.chat.title);
      await ctx.reply(chatStatus(false), HTML);
      return;
    }
    await ctx.reply(chatUsage(), HTML);
  });

  bot.command('time', async (ctx) => {
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
  });

  bot.command('weather', async (ctx) => {
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
  });

  bot.command('seed', async (ctx) => {
    await ctx.reply(seedText(parseSeed(await rconSend('seed'))), HTML);
  });

  bot.command('difficulty', async (ctx) => {
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
  });

  bot.command('say', async (ctx) => {
    if (!(await requireOwner(ctx))) {
      return;
    }
    const text = commandArgs(ctx);
    if (!text) {
      await ctx.reply(sayUsage(), HTML);
      return;
    }
    await rconSend(`say ${text}`);
    await ctx.reply(sayDone(), HTML);
  });

  bot.command('whitelist', async (ctx) => {
    if (!(await requireOwner(ctx))) {
      return;
    }
    const args = commandArgs(ctx);
    if (!args) {
      await ctx.reply(whitelistUsage(), HTML);
      return;
    }
    const result = stripMcColor(await rconSend(`whitelist ${args}`));
    await ctx.reply(result ? `<pre>${escapeHtml(result).slice(0, 3500)}</pre>` : 'Команда выполнена.', HTML);
  });

  bot.command('rcon', async (ctx) => {
    if (!(await requireOwner(ctx))) {
      return;
    }
    const command = commandArgs(ctx);
    if (!command) {
      await ctx.reply(rconUsage(), HTML);
      return;
    }
    const result = stripMcColor(await rconSend(command));
    await ctx.reply(result ? `<pre>${escapeHtml(result).slice(0, 3500)}</pre>` : rconEmpty(), HTML);
  });
}

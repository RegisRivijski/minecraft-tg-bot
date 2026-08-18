import { Telegraf } from 'telegraf';

import config from '../config/default.js';
import { OWNER_IDS } from './constants/access.js';
import allowedChat from './middlewares/allowedChat.js';
import errorsHandler from './middlewares/errorsHandler.js';
import { registerRoutes } from './routes/index.js';
import { registerBotCommands } from './helpers/telegramCommandsHelper.js';
import { closeRcon } from './classes/ServiceSingletons/RconSingleton.js';
import {
  getForumSummary,
  getGroupChatId,
  warnIfForumMisconfigured,
} from './helpers/forumHelper.js';
import { warnIfBridgeCannotRead } from './helpers/chatBridgeHelper.js';
import { startChannelWatchers } from './helpers/channelWatcherHelper.js';
import { startPlayerWatcher } from './helpers/playerWatcherHelper.js';
import { startLogWatcher } from './helpers/logWatcherHelper.js';
import { flushWorldStats, initWorldStats } from './helpers/worldStatsHelper.js';

function buildTelegramApiRoot() {
  if (!config.telegramBotApi.host || !config.telegramBotApi.port) {
    return undefined;
  }
  return `${config.telegramBotApi.protocol}//${config.telegramBotApi.host}:${config.telegramBotApi.port}`;
}

function createBot(apiRoot) {
  return new Telegraf(config.bot.apiToken, apiRoot ? { telegram: { apiRoot } } : {});
}

function printStartupTable(apiRoot) {
  const forum = getForumSummary();
  console.table({
    Application: config.application.name,
    Version: config.application.version,
    Rcon: `${config.rcon.host}:${config.rcon.port}`,
    Address: config.server.address,
    Owners: OWNER_IDS.join(', ') || '—',
    Group: forum.group,
    Weather: forum.weather,
    Events: forum.events,
    Chat: forum.chat,
    Log: config.server.logPath,
    LocalApi: Boolean(apiRoot),
  });
}

function listenForShutdown({ bot, stopPlayerWatcher, stopLogWatcher, stopChannelWatchers }) {
  const shutdown = async (signal) => {
    stopPlayerWatcher();
    stopLogWatcher();
    stopChannelWatchers();
    await flushWorldStats();
    await closeRcon();
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

export default async function main() {
  if (!config.bot.apiToken) {
    throw new Error('MINECRAFT_TG_BOT_API_TOKEN is required');
  }
  if (!OWNER_IDS.length) {
    console.warn('[acl] OWNER_IDS is empty — fill app/constants/access.js');
  }
  if (!getGroupChatId()) {
    console.warn('[forum] GROUP_ID is empty — fill app/constants/access.js');
  }

  const apiRoot = buildTelegramApiRoot();
  const bot = createBot(apiRoot);

  bot.use(errorsHandler);
  bot.use(allowedChat);
  registerRoutes(bot);
  bot.catch((error) => {
    console.error('[telegraf]', error.code || error.message);
  });

  await warnIfForumMisconfigured(bot.telegram);
  await warnIfBridgeCannotRead(bot.telegram);
  await initWorldStats();

  const stopPlayerWatcher = startPlayerWatcher(bot.telegram);
  const stopLogWatcher = startLogWatcher(bot.telegram);
  const stopChannelWatchers = startChannelWatchers(bot.telegram);

  await bot.launch({
    allowedUpdates: ['message', 'my_chat_member'],
  });
  await registerBotCommands(bot).catch((error) => {
    console.warn('[telegram] setMyCommands failed:', error.message);
  });

  printStartupTable(apiRoot);
  listenForShutdown({
    bot, stopPlayerWatcher, stopLogWatcher, stopChannelWatchers,
  });

  return bot;
}

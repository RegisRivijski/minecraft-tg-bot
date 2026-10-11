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
  const { protocol, host, port } = config.telegramBotApi;
  if (!protocol || !host || !port) {
    return undefined;
  }
  return `${protocol}//${host}:${port}`;
}

function requireEnv(value, name) {
  if (!value && value !== 0) {
    throw new Error(`${name} is required`);
  }
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
    Events: forum.events,
    Chat: forum.chat,
    Status: forum.status,
    Log: config.server.logPath,
    LocalApi: Boolean(apiRoot),
    Assets: config.assets.baseUrl || '—',
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
  requireEnv(config.bot.apiToken, 'MINECRAFT_TG_BOT_API_TOKEN');
  requireEnv(config.rcon.host, 'MINECRAFT_RCON_HOST');
  requireEnv(config.rcon.port, 'MINECRAFT_RCON_PORT');
  requireEnv(config.rcon.password, 'MINECRAFT_RCON_PASSWORD');
  requireEnv(config.server.motd, 'MINECRAFT_MOTD');
  requireEnv(config.server.address, 'MINECRAFT_ADDRESS');
  requireEnv(config.server.logPath, 'MINECRAFT_LOG_PATH');
  requireEnv(config.server.timeZone, 'MINECRAFT_TZ');
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

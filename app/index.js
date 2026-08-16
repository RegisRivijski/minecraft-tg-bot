import { Telegraf } from 'telegraf';

import config from '../config/default.js';
import { OWNER_IDS } from './constants/access.js';
import allowedChat from './middlewares/allowedChat.js';
import errorsHandler from './middlewares/errorsHandler.js';
import { registerRoutes } from './routes/index.js';
import { registerBotCommands } from './helpers/telegramCommandsHelper.js';
import minecraftTgBot from './classes/MongooseSignletons/MongooseMinecraftTgBotSingleton.js';
import { closeRcon } from './classes/ServiceSingletons/RconSingleton.js';
import { loadChatRelay } from './helpers/chatRelayHelper.js';
import { accessSnapshot } from './helpers/accessHelper.js';
import { loadAccess } from './helpers/viewerHelper.js';
import { startPlayerWatcher } from './helpers/playerWatcherHelper.js';
import { startLogWatcher } from './helpers/logWatcherHelper.js';

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
  console.table({
    Application: config.application.name,
    Version: config.application.version,
    Rcon: `${config.rcon.host}:${config.rcon.port}`,
    Address: config.server.address,
    Owners: OWNER_IDS.join(', ') || '—',
    Viewers: accessSnapshot().approved.join(', ') || '—',
    Log: config.server.logPath,
    Mongo: config.db.mongodb.options.dbName,
    LocalApi: Boolean(apiRoot),
  });
}

function listenForShutdown({ bot, stopPlayerWatcher, stopLogWatcher }) {
  const shutdown = async (signal) => {
    stopPlayerWatcher();
    stopLogWatcher();
    await closeRcon();
    await minecraftTgBot.close().catch(() => {});
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
  if (!config.db.mongodb.url) {
    throw new Error('MONGODB_1_HOSTNAME is required');
  }
  if (!OWNER_IDS.length) {
    console.warn('[acl] OWNER_IDS is empty — fill app/constants/access.js');
  }

  await minecraftTgBot.asPromise();
  await loadAccess();
  await loadChatRelay();

  const apiRoot = buildTelegramApiRoot();
  const bot = createBot(apiRoot);

  bot.use(errorsHandler);
  bot.use(allowedChat);
  registerRoutes(bot);
  bot.catch((error) => {
    console.error('[telegraf]', error.code || error.message);
  });

  const stopPlayerWatcher = startPlayerWatcher(bot.telegram);
  const stopLogWatcher = startLogWatcher(bot.telegram);

  await bot.launch({
    allowedUpdates: ['message', 'callback_query', 'my_chat_member'],
  });
  await registerBotCommands(bot).catch((error) => {
    console.warn('[telegram] setMyCommands failed:', error.message);
  });

  printStartupTable(apiRoot);
  listenForShutdown({ bot, stopPlayerWatcher, stopLogWatcher });

  return bot;
}

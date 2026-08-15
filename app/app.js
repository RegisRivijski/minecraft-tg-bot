import { Telegraf } from 'telegraf';

import config from '../config/default.js';
import { CHAT_IDS, OWNER_IDS } from './constants/access.js';
import allowedChat from './middlewares/allowedChat.js';
import errorHandler from './middlewares/errorHandler.js';
import { registerCommands } from './handlers/commands.js';
import { registerBotCommands } from './helpers/telegramCommands.js';
import minecraftTgBot from './classes/MongooseSingleton.js';
import { closeRcon } from './modules/rconClient.js';
import { loadChatRelay } from './modules/chatRelay.js';
import { startPlayerWatcher } from './modules/playerWatcher.js';
import { startLogWatcher } from './modules/logWatcher.js';

function buildTelegramApiRoot() {
  if (!config.telegramBotApi.host || !config.telegramBotApi.port) {
    return undefined;
  }
  return `${config.telegramBotApi.protocol}//${config.telegramBotApi.host}:${config.telegramBotApi.port}`;
}

export default async function main() {
  if (!config.bot.apiToken) {
    throw new Error('MINECRAFT_TG_BOT_API_TOKEN is required');
  }
  if (!OWNER_IDS.length && !CHAT_IDS.length) {
    console.warn('[acl] OWNER_IDS and CHAT_IDS are empty — fill app/constants/access.js');
  }

  await minecraftTgBot.asPromise();
  await loadChatRelay();

  const apiRoot = buildTelegramApiRoot();
  const bot = new Telegraf(config.bot.apiToken, apiRoot ? { telegram: { apiRoot } } : {});

  bot.use(errorHandler);
  bot.use(allowedChat);
  registerCommands(bot);

  bot.catch((error) => {
    console.error('[telegraf]', error.code || error.message);
  });

  await bot.launch();
  await registerBotCommands(bot).catch((error) => {
    console.warn('[telegram] setMyCommands failed:', error.message);
  });

  const stopWatcher = startPlayerWatcher(bot.telegram);
  const stopLogWatcher = startLogWatcher(bot.telegram);

  console.table({
    Application: config.application.name,
    Version: config.application.version,
    Rcon: `${config.rcon.host}:${config.rcon.port}`,
    Address: config.server.address,
    Owners: OWNER_IDS.join(', ') || '—',
    Chats: CHAT_IDS.join(', ') || '—',
    Log: config.server.logPath,
    Mongo: config.db.mongodb.options.dbName,
    LocalApi: Boolean(apiRoot),
  });

  const stop = async (signal) => {
    stopWatcher();
    stopLogWatcher();
    await closeRcon();
    await minecraftTgBot.close().catch(() => {});
    bot.stop(signal);
    process.exit(0);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  return bot;
}

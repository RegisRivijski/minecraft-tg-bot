import * as adminController from '../controllers/adminController.js';
import * as mainController from '../controllers/mainController.js';
import * as serverController from '../controllers/serverController.js';
import * as worldController from '../controllers/worldController.js';
import { relayTelegramChat } from '../helpers/chatBridgeHelper.js';

export function registerRoutes(bot) {
  bot.start(mainController.start);
  bot.command('help', mainController.help);

  bot.command('server', serverController.server);
  bot.command('list', serverController.list);

  bot.command('time', worldController.time);
  bot.command('weather', worldController.weather);
  bot.command('seed', worldController.seed);
  bot.command('difficulty', worldController.difficulty);

  bot.command('say', adminController.say);
  bot.command('whitelist', adminController.whitelist);
  bot.command('rcon', adminController.rcon);

  bot.on('message', relayTelegramChat);
  bot.on('my_chat_member', mainController.onMyChatMember);
}

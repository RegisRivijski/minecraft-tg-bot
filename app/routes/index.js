import * as adminController from '../controllers/adminController.js';
import * as chatController from '../controllers/chatController.js';
import * as mainController from '../controllers/mainController.js';
import * as serverController from '../controllers/serverController.js';
import * as worldController from '../controllers/worldController.js';

export function registerRoutes(bot) {
  bot.start(mainController.start);
  bot.command('help', mainController.help);

  bot.command('server', serverController.server);
  bot.command(['list', 'online'], serverController.list);

  bot.command('chat', chatController.chat);
  bot.command('joins', chatController.joins);

  bot.command('time', worldController.time);
  bot.command('weather', worldController.weather);
  bot.command('seed', worldController.seed);
  bot.command('difficulty', worldController.difficulty);

  bot.command('say', adminController.say);
  bot.command('whitelist', adminController.whitelist);
  bot.command('rcon', adminController.rcon);
}

import * as adminController from '../controllers/adminController.js';
import * as chatController from '../controllers/chatController.js';
import * as mainController from '../controllers/mainController.js';
import * as serverController from '../controllers/serverController.js';
import * as viewerController from '../controllers/viewerController.js';
import * as worldController from '../controllers/worldController.js';

export function registerRoutes(bot) {
  bot.start(mainController.start);
  bot.command('help', mainController.help);

  bot.command('server', serverController.server);
  bot.command('list', serverController.list);

  bot.command('notify', chatController.notify);

  bot.command('viewers', viewerController.viewers);

  bot.command('time', worldController.time);
  bot.command('weather', worldController.weather);
  bot.command('seed', worldController.seed);
  bot.command('difficulty', worldController.difficulty);

  bot.command('say', adminController.say);
  bot.command('whitelist', adminController.whitelist);
  bot.command('rcon', adminController.rcon);

  bot.action(/^n:(chat|joins|deaths|adv)$/, chatController.onNotifyToggle);
  bot.action(/^r:(ok|no):(-?\d+)$/, viewerController.onRequestDecision);
  bot.action(/^v:(ok|no|x|on):(-?\d+)$/, viewerController.onViewerAction);
  bot.on('my_chat_member', viewerController.onMyChatMember);
}

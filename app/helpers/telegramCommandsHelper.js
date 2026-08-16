import { OWNER_IDS } from '../constants/access.js';

const MENU_COMMANDS = [
  { command: 'help', description: 'Помощь' },
  { command: 'server', description: 'Статус мира' },
  { command: 'seed', description: 'Зерно мира' },
  { command: 'notify', description: 'Рассылки в этот чат' },
  { command: 'say', description: 'Сказать в чат мира' },
];

const OWNER_COMMANDS = [
  ...MENU_COMMANDS,
  { command: 'viewers', description: 'Кто смотрит сервер' },
  { command: 'time', description: 'Установить время' },
  { command: 'weather', description: 'Установить погоду' },
  { command: 'difficulty', description: 'Установить сложность' },
  { command: 'whitelist', description: 'Вайтлист' },
  { command: 'rcon', description: 'Консоль сервера' },
];

export async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands(MENU_COMMANDS);
  await Promise.all(OWNER_IDS.map((ownerId) => (
    bot.telegram.setMyCommands(OWNER_COMMANDS, {
      scope: { type: 'chat', chat_id: ownerId },
    })
  )));
  console.info(`[telegram] registered ${MENU_COMMANDS.length} menu commands`);
}

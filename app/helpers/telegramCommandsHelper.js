import { OWNER_IDS } from '../constants/access.js';

const OWNER_COMMANDS = [
  { command: 'help', description: 'Помощь' },
  { command: 'server', description: 'Статус мира' },
  { command: 'seed', description: 'Зерно мира' },
  { command: 'say', description: 'Сказать в чат мира' },
  { command: 'time', description: 'Установить время' },
  { command: 'weather', description: 'Установить погоду' },
  { command: 'difficulty', description: 'Установить сложность' },
  { command: 'whitelist', description: 'Вайтлист' },
  { command: 'rcon', description: 'Консоль сервера' },
];

export async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands([]);
  await Promise.all(OWNER_IDS.map((ownerId) => (
    bot.telegram.setMyCommands(OWNER_COMMANDS, {
      scope: { type: 'chat', chat_id: ownerId },
    })
  )));
  console.info(`[telegram] registered ${OWNER_COMMANDS.length} owner commands`);
}

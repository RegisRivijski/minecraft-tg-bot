const MENU_COMMANDS = [
  { command: 'help', description: 'Помощь' },
  { command: 'server', description: 'Меню мира' },
  { command: 'list', description: 'Игроки на сервере' },
  { command: 'time', description: 'Время суток' },
  { command: 'seed', description: 'Зерно мира' },
  { command: 'difficulty', description: 'Сложность' },
  { command: 'chat', description: 'Чат мира в этот чат' },
  { command: 'joins', description: 'Вход и выход игроков' },
];

export async function registerBotCommands(bot) {
  await bot.telegram.setMyCommands(MENU_COMMANDS);
  console.info(`[telegram] registered ${MENU_COMMANDS.length} menu commands`);
}

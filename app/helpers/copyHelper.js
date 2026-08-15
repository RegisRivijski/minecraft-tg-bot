import config from '../../config/default.js';
import { describeTps, escapeHtml, formatPlayerName, formatPlayerNames } from './minecraftHelper.js';

export const HTML = { parse_mode: 'HTML' };

export function loadingWorld() {
  return [
    '<i>Загрузка мира...</i>',
    '',
    `<b>${escapeHtml(config.server.motd)}</b>`,
    'Режим игры: Выживание',
    `Сервер: <code>${escapeHtml(config.server.address)}</code>`,
    '',
    'Введите /help для списка команд.',
  ].join('\n');
}

export function helpText(owner = false) {
  const lines = [
    '--- <b>Помощь</b> ---',
    '',
    '/server — меню мира',
    '/list — игроки на сервере',
    '/time — время суток',
    '/seed — зерно мира',
    '/difficulty — сложность',
    '/chat on|off — чат мира в этот чат',
    '/joins on|off — вход и выход игроков в этот чат',
    '/deaths on|off — смерти игроков в этот чат',
    '/advancements on|off — достижения в этот чат',
    '/say &lt;текст&gt; — сказать в чат мира',
  ];
  if (owner) {
    lines.push(
      '',
      '--- <b>Оператор</b> ---',
      '/time day|night|noon|midnight — установить время',
      '/weather clear|rain|thunder — погода',
      '/difficulty peaceful|easy|normal|hard',
      '/whitelist add|remove|list &lt;ник&gt;',
      '/rcon &lt;команда&gt; — консоль сервера',
    );
  }
  return lines.join('\n');
}

export function noPermission() {
  return 'У вас нет разрешения на использование этой команды.';
}

export function deniedText({ userId, chatId, isPrivate }) {
  const lines = ['У вас нет разрешения на использование этой команды.'];
  if (isPrivate && userId) {
    lines.push('', `id игрока: <code>${userId}</code>`);
  } else if (chatId) {
    lines.push('', `id мира: <code>${chatId}</code>`);
  }
  lines.push('Пропиши id в <code>app/constants/access.js</code>.');
  return lines.join('\n');
}

export function serverMenu({ list, daytime, worldDay, difficulty, tps }) {
  const lines = [
    `<b>${escapeHtml(config.server.motd)}</b>`,
    `Сервер: <code>${escapeHtml(config.server.address)}</code>`,
    'Режим игры: Выживание',
    '',
  ];

  if (list.ok) {
    lines.push(`Игроки: ${list.online} / ${list.max}`);
    lines.push(list.players.length ? formatPlayerNames(list.players) : 'На сервере нет игроков.');
  } else if (list.raw) {
    lines.push(escapeHtml(list.raw));
  }

  lines.push('', `${daytime.icon} Время: <b>${daytime.label}</b>`);
  if (worldDay != null) {
    lines.push(`День ${worldDay}`);
  }
  if (difficulty) {
    lines.push(`Сложность: <b>${escapeHtml(difficulty)}</b>`);
  }
  if (tps != null) {
    const tpsText = describeTps(tps);
    if (tpsText) {
      lines.push(tpsText);
    }
  }
  return lines.join('\n');
}

export function listText(list) {
  if (!list.ok) {
    return list.raw || 'Не удалось получить список игроков.';
  }
  if (!list.players.length) {
    return `На сервере нет игроков. (${list.online} / ${list.max})`;
  }
  return `Сейчас на сервере ${list.online} из ${list.max}:\n${formatPlayerNames(list.players)}`;
}

export function timeText(daytime, worldDay) {
  const lines = [`${daytime.icon} ${daytime.label}`];
  if (worldDay != null) {
    lines.push(`День ${worldDay}`);
  }
  return lines.join('\n');
}

export function timeSetUsage() {
  return 'Использование: /time day|night|noon|midnight';
}

export function timeSetDone(label) {
  return `Установлено время: ${label}`;
}

export function weatherUsage() {
  return 'Использование: /weather clear|rain|thunder';
}

export function weatherSetDone(label) {
  return `Погода изменена: ${label}`;
}

export function seedText(seed) {
  if (seed == null) {
    return 'Не удалось прочитать зерно мира.';
  }
  return `Зерно мира: <code>${escapeHtml(String(seed))}</code>`;
}

export function difficultyText(label) {
  if (!label) {
    return 'Не удалось прочитать сложность.';
  }
  return `Сложность: <b>${escapeHtml(label)}</b>`;
}

export function difficultyUsage() {
  return 'Использование: /difficulty peaceful|easy|normal|hard';
}

export function sayUsage() {
  return 'Использование: /say &lt;сообщение&gt;';
}

export function sayDone(name) {
  if (!name) {
    return '[Сервер] Сообщение отправлено в чат мира.';
  }
  return `[Сервер] ${formatPlayerName(name)}: сообщение отправлено в чат мира.`;
}

export function whitelistUsage() {
  return [
    'Использование:',
    '/whitelist list',
    '/whitelist add &lt;ник&gt;',
    '/whitelist remove &lt;ник&gt;',
  ].join('\n');
}

export function rconUsage() {
  return 'Использование: /rcon &lt;команда&gt;';
}

export function rconEmpty() {
  return 'Команда выполнена.';
}

export function connectionLost() {
  return 'Соединение с сервером потеряно.';
}

export function unknownError() {
  return 'Произошла неизвестная ошибка.';
}

export function chatUsage() {
  return 'Использование: /chat on|off';
}

export function chatStatus(enabled) {
  return enabled ? 'Чат мира: включён' : 'Чат мира: выключен';
}

export function joinsUsage() {
  return 'Использование: /joins on|off';
}

export function joinsStatus(enabled) {
  return enabled ? 'Вход и выход: включён' : 'Вход и выход: выключен';
}

export function deathsUsage() {
  return 'Использование: /deaths on|off';
}

export function deathsStatus(enabled) {
  return enabled ? 'Смерти: включены' : 'Смерти: выключены';
}

export function advancementsUsage() {
  return 'Использование: /advancements on|off';
}

export function advancementsStatus(enabled) {
  return enabled ? 'Достижения: включены' : 'Достижения: выключены';
}

export function eventsSplitHint() {
  return 'Используйте /deaths и /advancements';
}

export function worldEventLine(event) {
  const text = escapeHtml(event.text);
  const name = event.name ? escapeHtml(event.name) : '';
  if (!name || !text.startsWith(name)) {
    return text;
  }
  return `${formatPlayerName(event.name)}${text.slice(name.length)}`;
}

export function chatRelayLine(name, message) {
  return `&lt;${formatPlayerName(name)}&gt; ${escapeHtml(message)}`;
}

export function joinLeaveText(joined, left, current) {
  const lines = [];
  for (const name of joined) {
    lines.push(`${formatPlayerName(name)} присоединился к игре`);
  }
  for (const name of left) {
    lines.push(`${formatPlayerName(name)} вышел из игры`);
  }
  if (current) {
    lines.push('');
    if (!current.players.length) {
      lines.push('На сервере нет игроков.');
    } else {
      lines.push(`Игроки (${current.online}/${current.max}): ${formatPlayerNames(current.players)}`);
    }
  }
  return lines.join('\n');
}

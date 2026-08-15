import config from '../../config/default.js';
import { escapeHtml, formatPlayerNames } from './minecraftHelper.js';

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
  ];
  if (owner) {
    lines.push(
      '',
      '--- <b>Оператор</b> ---',
      '/time day|night|noon|midnight — установить время',
      '/weather clear|rain|thunder — погода',
      '/difficulty peaceful|easy|normal|hard',
      '/say &lt;текст&gt; — сказать в чат мира',
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
  if (tps) {
    lines.push(`TPS: ${escapeHtml(tps)}`);
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
  const ticks = daytime.ticks != null ? ` (${daytime.ticks})` : '';
  const lines = [`${daytime.icon} ${daytime.label}${ticks}`];
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

export function sayDone() {
  return '[Сервер] Сообщение отправлено в чат мира.';
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

export function chatRelayLine(name, message) {
  return `&lt;${escapeHtml(name)}&gt; ${escapeHtml(message)}`;
}

export function joinLeaveText(joined, left, current) {
  const lines = [];
  for (const name of joined) {
    lines.push(`${escapeHtml(name)} присоединился к игре`);
  }
  for (const name of left) {
    lines.push(`${escapeHtml(name)} вышел из игры`);
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

import config from '../../config/default.js';
import { describeTps, escapeHtml, formatPlayerName, formatPlayerNames } from './minecraftHelper.js';

export const HTML = { parse_mode: 'HTML' };

export function htmlMarkup(inlineKeyboard) {
  return {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: inlineKeyboard },
  };
}

export function startText() {
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
    '/server — статус мира',
    '/seed — зерно мира',
    '/notify — рассылки в этот чат',
    '/say &lt;текст&gt; — сказать в чат мира',
  ];
  if (owner) {
    lines.push(
      '',
      '--- <b>Оператор</b> ---',
      '/viewers — кто смотрит сервер',
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

export function accessGateText(status) {
  if (status === 'pending') {
    return 'Заявка на просмотр сервера уже отправлена. Ждём решения владельца.';
  }
  return 'Заявка на просмотр сервера отправлена владельцу. Когда её одобрят, можно будет смотреть статус мира и включать рассылки.';
}

export function accessRequestOwnerText({ kind, label, chatId, from }) {
  const type = kind === 'group' ? 'группа' : 'личные сообщения';
  const lines = [
    '<b>Заявка на просмотр сервера</b>',
    '',
    `Тип: ${type}`,
    `Кто: ${escapeHtml(label)}`,
  ];
  if (kind === 'group' && from) {
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
      || from.username
      || from.id;
    lines.push(`От: ${escapeHtml(String(name))}`);
  }
  lines.push(`id: <code>${chatId}</code>`);
  return lines.join('\n');
}

export function accessRequestKeyboard(chatId) {
  return [
    [
      { text: 'Одобрить', callback_data: `r:ok:${chatId}` },
      { text: 'Отклонить', callback_data: `r:no:${chatId}` },
    ],
  ];
}

export function accessApprovedViewerText() {
  return 'Доступ к просмотру сервера одобрен. /help — список команд, /notify — рассылки.';
}

export function accessDeniedViewerText() {
  return 'Владелец отклонил доступ к просмотру сервера.';
}

export function accessRevokedViewerText() {
  return 'Доступ к просмотру сервера отключён.';
}

export function accessDecisionDone({ approved, label }) {
  return approved
    ? `Одобрено: ${escapeHtml(label)}`
    : `Отклонено: ${escapeHtml(label)}`;
}

export function groupAccessGranted() {
  return 'Этот чат может смотреть сервер. /notify — рассылки в этот чат.';
}

export function notifyPanelText(chat) {
  const where = chat?.type === 'private'
    ? 'личные сообщения'
    : (chat?.title ? `чат «${escapeHtml(chat.title)}»` : 'этот чат');
  return [
    '<b>Рассылки</b>',
    `Куда: ${where}`,
    '',
    'Кнопки включают и выключают уведомления <i>только здесь</i>. Другие чаты не затрагиваются.',
  ].join('\n');
}

export function notifyToggleLabel(key, enabled) {
  const names = {
    chat: 'Чат мира',
    joins: 'Вход и выход',
    deaths: 'Смерти',
    adv: 'Достижения',
  };
  return `${enabled ? '✅' : '❌'} ${names[key]}`;
}

export function notifyNotAdmin() {
  return 'Рассылки этого чата могут менять только админы.';
}

function viewerKindLabel(kind) {
  return kind === 'group' ? 'группа' : 'личка';
}

function viewerBullet(entry) {
  return `• ${escapeHtml(entry.label)} · ${viewerKindLabel(entry.kind)} · <code>${entry.chatId}</code>`;
}

export function viewersEmpty() {
  return [
    '<b>Кто смотрит сервер</b>',
    '',
    'Пока никто. Заявки появятся, когда кто-то напишет боту /start или добавит его в чат.',
  ].join('\n');
}

export function viewersListText(entries) {
  if (!entries.length) {
    return viewersEmpty();
  }

  const pending = entries.filter((entry) => entry.status === 'pending');
  const approved = entries.filter((entry) => entry.status === 'approved');
  const revoked = entries.filter((entry) => entry.status === 'revoked');
  const lines = ['<b>Кто смотрит сервер</b>'];

  if (pending.length) {
    lines.push('', '<i>Ожидают</i>');
    lines.push(...pending.map(viewerBullet));
  }
  if (approved.length) {
    lines.push('', '<i>Одобрены</i>');
    lines.push(...approved.map(viewerBullet));
  }
  if (revoked.length) {
    lines.push('', '<i>Отключены</i>');
    lines.push(...revoked.map(viewerBullet));
  }

  lines.push('', 'Кнопки ниже — одобрить, отклонить, отключить или вернуть доступ.');
  return lines.join('\n');
}

function shortButtonLabel(label) {
  const text = String(label || '').trim() || 'без имени';
  return text.length > 28 ? `${text.slice(0, 27)}…` : text;
}

export function viewersKeyboard(entries) {
  const rows = [];
  for (const entry of entries) {
    const name = shortButtonLabel(entry.label);
    if (entry.status === 'pending') {
      rows.push([
        { text: `✓ ${name}`, callback_data: `v:ok:${entry.chatId}` },
        { text: '✗', callback_data: `v:no:${entry.chatId}` },
      ]);
    } else if (entry.status === 'approved') {
      rows.push([
        { text: `Отключить · ${name}`, callback_data: `v:x:${entry.chatId}` },
      ]);
    } else {
      rows.push([
        { text: `Включить · ${name}`, callback_data: `v:on:${entry.chatId}` },
      ]);
    }
  }
  return rows;
}

export function serverMenu({ list, daytime, weather, difficulty, tps }) {
  const lines = [
    `<b>${escapeHtml(config.server.motd)}</b>`,
    `Сервер: <code>${escapeHtml(config.server.address)}</code>`,
    'Режим игры: Выживание',
  ];

  if (difficulty) {
    lines.push(`Сложность: <b>${escapeHtml(difficulty)}</b>`);
  }
  if (tps != null) {
    const tpsText = describeTps(tps);
    if (tpsText) {
      lines.push(tpsText);
    }
  }

  lines.push('');

  if (list.ok) {
    lines.push(`Игроки: ${list.online} / ${list.max}`);
    lines.push(list.players.length ? formatPlayerNames(list.players) : 'На сервере нет игроков.');
  } else if (list.raw) {
    lines.push(escapeHtml(list.raw));
  }

  lines.push('', `${daytime.icon} Время: <b>${daytime.label}</b>`);
  if (weather) {
    lines.push(`${weather.icon} Погода: <b>${escapeHtml(weather.label)}</b>`);
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

export function timeText(daytime) {
  return `${daytime.icon} ${daytime.label}`;
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

export function weatherText(weather) {
  if (!weather) {
    return 'Не удалось прочитать погоду.';
  }
  return `${weather.icon} Погода: <b>${escapeHtml(weather.label)}</b>`;
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

export function joinLeaveText(events, current) {
  const lines = [];
  for (const event of events) {
    if (event.type === 'join') {
      lines.push(`${formatPlayerName(event.name)} присоединился к игре`);
    } else {
      lines.push(`${formatPlayerName(event.name)} вышел из игры`);
    }
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

import config from '../../config/default.js';
import { describeTps, escapeHtml, formatPlayerName, formatPlayerNames, petTypeLabel } from './minecraftHelper.js';

export const HTML = { parse_mode: 'HTML' };

export function startText() {
  return [
    '<i>Загрузка мира...</i>',
    '',
    `<b>${escapeHtml(config.server.motd)}</b>`,
    'Режим игры: Выживание',
    `Сервер: <code>${escapeHtml(config.server.address)}</code>`,
    '',
    'Чат мира дублируется в группу, события — в канал. Здесь — команды оператора, /help.',
  ].join('\n');
}

export function helpText() {
  return [
    '--- <b>Оператор</b> ---',
    '/server — статус мира',
    '/seed — зерно мира',
    '/say &lt;текст&gt; — сказать в чат мира',
    '/time day|night|noon|midnight — установить время',
    '/weather clear|rain|thunder — погода',
    '/difficulty peaceful|easy|normal|hard',
    '/whitelist add|remove|list &lt;ник&gt;',
    '/rcon &lt;команда&gt; — консоль сервера',
  ].join('\n');
}

export function noPermission() {
  return 'У вас нет разрешения на использование этой команды.';
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

export function weatherChangedText(previous, current) {
  if (!current) {
    return '';
  }
  if (!previous || previous.key === current.key) {
    return `${current.icon} Погода: <b>${escapeHtml(current.label)}</b>`;
  }
  return `${previous.icon} → ${current.icon} Погода: <b>${escapeHtml(current.label)}</b>`;
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

export function onlineDigestText({ list, daytime, weather }) {
  const lines = [
    `<b>На сервере ${list.online} из ${list.max}</b>`,
    formatPlayerNames(list.players),
  ];
  if (daytime?.label) {
    lines.push('', `${daytime.icon} ${daytime.label}`);
  }
  if (weather) {
    lines.push(`${weather.icon} ${escapeHtml(weather.label)}`);
  }
  return lines.join('\n');
}

export function firstJoinText(name) {
  return `${formatPlayerName(name)} впервые в этом мире`;
}

export function nightSkipText() {
  return '🌙 Ночь пропущена — все легли спать.';
}

export function petDeathLine(event) {
  const text = worldEventLine(event);
  const kind = petTypeLabel(event.entityType);
  return kind ? `${text} · ${escapeHtml(kind)}` : text;
}

export function tpsAlertText(tps) {
  return describeTps(tps) || `Сервер лагает (${Number(tps).toFixed(1)} TPS)`;
}

export function tpsRecoveredText(tps) {
  const detail = tps != null && !Number.isNaN(Number(tps))
    ? ` (${Number(tps).toFixed(1)} TPS)`
    : '';
  return `Сервер снова работает плавно${detail}`;
}

export function serverStartedText() {
  return 'Мир запущен.';
}

export function serverStoppingText() {
  return 'Сервер останавливается.';
}

export function moonPhaseText(moon) {
  if (!moon) {
    return '';
  }
  return `${moon.icon} ${escapeHtml(moon.label)}`;
}

export function emptyWorldText({ sinceLabel, hours }) {
  const duration = hours === 1 ? '1 ч' : `${hours} ч`;
  return `Мир пуст с ${escapeHtml(sinceLabel)} (уже ${duration}).`;
}

export function dailyRecapText({ dateLabel, players, deaths, advancements, moon }) {
  const lines = [`<b>Итоги дня</b> · ${escapeHtml(dateLabel)}`];
  lines.push(players.length
    ? `Заходили: ${formatPlayerNames(players)}`
    : 'Сегодня никто не заходил.');
  lines.push(`Смертей: <b>${deaths}</b>`);
  lines.push(`Достижений: <b>${advancements}</b>`);
  if (moon?.label) {
    lines.push('', `${moon.icon} ${escapeHtml(moon.label)}`);
  }
  return lines.join('\n');
}

export function weeklyRecapText({ playTop, deathTop }) {
  const lines = ['<b>Итоги недели</b>'];
  if (playTop.length) {
    lines.push('', 'Онлайн:');
    playTop.forEach((row, index) => {
      lines.push(`${index + 1}. ${formatPlayerName(row.name)} — ${escapeHtml(row.duration)}`);
    });
  }
  if (deathTop.length) {
    lines.push('', 'Смерти:');
    deathTop.forEach((row, index) => {
      lines.push(`${index + 1}. ${formatPlayerName(row.name)} — ${row.count}`);
    });
  }
  return lines.join('\n');
}

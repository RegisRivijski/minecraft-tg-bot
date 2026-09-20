import config from '../../config/default.js';
import { describeTps, escapeHtml, formatPlayerName, formatPlayerNames, petTypeLabel } from './minecraftHelper.js';
import { resolveAdvancement } from './langHelper.js';

export const HTML = { parse_mode: 'HTML' };
export const HTML_NO_PREVIEW = {
  parse_mode: 'HTML',
  disable_web_page_preview: true,
  link_preview_options: { is_disabled: true },
};

export function startText() {
  return [
    '<i>Загрузка мира...</i>',
    '',
    `<b>${escapeHtml(config.server.motd)}</b>`,
    'Режим игры: Выживание',
    `Сервер: <code>${escapeHtml(config.server.address)}</code>`,
    '',
    'Чат мира и события идут в ветки группы. Вайтлист — /whitelist в общем чате группы. Здесь — команды оператора, /help.',
  ].join('\n');
}

export function helpText() {
  return [
    '--- <b>Оператор</b> ---',
    '/server — сводка мира, диск, сейв',
    '/seed — зерно мира',
    '/say &lt;текст&gt; — сказать в чат мира',
    '/time day|night|noon|midnight — установить время',
    '/weather clear|rain|thunder — погода',
    '/difficulty peaceful|easy|normal|hard',
    '/whitelist add|remove|list &lt;ник&gt; — ЛС и общий чат группы',
    '/rcon &lt;команда&gt; — консоль сервера',
  ].join('\n');
}

export function noPermission() {
  return 'У вас нет разрешения на использование этой команды.';
}

export function serverMenu({
  list, daytime, weather, difficulty, tps, tpsWindows,
  seed, moon, whitelist, gamerules, stats, host,
}) {
  const lines = [
    `<b>${escapeHtml(config.server.motd)}</b>`,
    `<code>${escapeHtml(config.server.address)}</code>`,
  ];

  const headerBits = ['Выживание'];
  if (difficulty) {
    headerBits.push(escapeHtml(difficulty));
  }
  lines.push(headerBits.join(' · '));

  const tpsLine = formatTpsLine(tps, tpsWindows);
  if (tpsLine) {
    lines.push('', tpsLine);
    if (tps != null && Number(tps) < 19.5) {
      const status = describeTps(tps);
      if (status) {
        lines.push(status);
      }
    }
  }

  lines.push('');
  appendPlayers(lines, list, stats);

  lines.push('');
  lines.push(...worldStatusLines({ weather, moon, daytime }));
  if (seed) {
    lines.push(`Зерно: <code>${escapeHtml(seed)}</code>`);
  }

  const ruleLine = formatGameruleLine(gamerules);
  if (ruleLine || whitelist?.ok) {
    lines.push('');
  }
  if (whitelist?.ok) {
    lines.push(formatWhitelistLine(whitelist, stats));
  } else if (stats?.knownPlayers) {
    lines.push(`Известных игроков: ${stats.knownPlayers}`);
  }
  if (ruleLine) {
    lines.push(ruleLine);
  }

  appendToday(lines, stats);
  appendHost(lines, host);
  return lines.join('\n');
}

function formatTpsLine(tps, windows) {
  const values = (windows?.length ? windows : [tps]).filter((value) => value != null && !Number.isNaN(Number(value)));
  if (!values.length) {
    return null;
  }
  const formatted = values.map((value, index) => {
    const text = Number(value).toFixed(1);
    return index === 0 ? `<b>${text}</b>` : text;
  }).join(' · ');
  return `TPS ${formatted}`;
}

function appendPlayers(lines, list, stats) {
  if (!list?.ok) {
    if (list?.raw) {
      lines.push(escapeHtml(list.raw));
    }
    return;
  }

  lines.push(`Игроки <b>${list.online}</b> / ${list.max}`);
  if (list.players.length) {
    for (const name of list.players) {
      const session = stats?.sessions?.[name];
      lines.push(session ? `${formatPlayerName(name)} · сегодня ${escapeHtml(session)}` : formatPlayerName(name));
    }
    return;
  }

  const emptyLine = formatEmptyLine(stats?.empty);
  lines.push(emptyLine || 'На сервере нет игроков.');
}

function formatEmptyLine(empty) {
  if (!empty?.sinceLabel) {
    return null;
  }
  let elapsed;
  if (empty.days) {
    elapsed = formatDays(empty.days);
  } else if (empty.hours >= 1) {
    elapsed = empty.hours === 1 ? '1 ч' : `${empty.hours} ч`;
  } else {
    elapsed = `${Math.max(1, empty.minutes || 1)} мин`;
  }
  return `Пусто с ${escapeHtml(empty.sinceLabel)} · уже ${elapsed}`;
}

function formatWhitelistLine(whitelist, stats) {
  const known = stats?.knownPlayers ? ` · известных ${stats.knownPlayers}` : '';
  if (!whitelist.players.length) {
    return `Вайтлист ${whitelist.count}${known}`;
  }
  const names = whitelist.players.length > 20
    ? `${formatPlayerNames(whitelist.players.slice(0, 20))} … +${whitelist.players.length - 20}`
    : formatPlayerNames(whitelist.players);
  return `Вайтлист ${whitelist.count}${known}: ${names}`;
}

function formatGameruleLine(rules) {
  if (!rules) {
    return null;
  }
  const bits = [];
  if (rules.keepInventory != null) {
    bits.push(rules.keepInventory ? 'инвентарь сохраняется' : 'инвентарь теряется');
  }
  if (rules.mobGriefing != null) {
    bits.push(rules.mobGriefing ? 'грифинг мобов' : 'без грифинга мобов');
  }
  if (rules.doMobSpawning === false) {
    bits.push('мобы не спавнятся');
  }
  if (rules.doDaylightCycle === false) {
    bits.push('время заморожено');
  }
  if (rules.doWeatherCycle === false) {
    bits.push('погода заморожена');
  }
  if (rules.playersSleepingPercentage != null) {
    bits.push(`сон ${rules.playersSleepingPercentage}%`);
  }
  if (rules.doImmediateRespawn) {
    bits.push('мгновенный респаун');
  }
  return bits.length ? bits.join(' · ') : null;
}

function formatPlayTop(rows) {
  return rows.map((row) => `${formatPlayerName(row.name)} — ${escapeHtml(row.duration)}`).join(' · ');
}

function appendToday(lines, stats) {
  if (!stats) {
    return;
  }
  const hasToday = stats.joined.length || stats.deaths || stats.advancements || stats.playTop?.length;
  if (hasToday) {
    lines.push('', `<b>Сегодня</b> · заходили ${stats.joined.length}`);
    if (stats.joined.length) {
      lines.push(formatPlayerNames(stats.joined));
    }
    if (stats.playTop?.length) {
      lines.push(`Играли: ${formatPlayTop(stats.playTop)}`);
    }
    if (stats.deaths || stats.advancements) {
      lines.push(`Смертей: <b>${stats.deaths}</b> · достижений: <b>${stats.advancements}</b>`);
    }
  }
  if (stats.weekPlayTop?.length) {
    lines.push('', `Неделя: ${formatPlayTop(stats.weekPlayTop)}`);
  }
}

function appendHost(lines, host) {
  if (!host?.dataSize && !host?.saved) {
    return;
  }
  lines.push('');
  if (host.dataSize) {
    lines.push(`minecraft-data: ${escapeHtml(host.dataSize)}`);
  }
  if (host.saved?.clock) {
    lines.push(`Последний сейв: ${escapeHtml(host.saved.clock)} · ${escapeHtml(host.saved.ago)}`);
  }
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

function formatMoonLine(moon) {
  if (!moon) {
    return null;
  }
  const day = Number.isFinite(moon.day) ? ` · день ${moon.day}` : '';
  return `${moon.icon} ${escapeHtml(moon.label)}${day}`;
}

function formatTimeLine(daytime) {
  if (!daytime?.label) {
    return null;
  }
  return `${daytime.icon} ${escapeHtml(daytime.label)}`;
}

function formatWeatherLine(weather) {
  if (!weather) {
    return null;
  }
  return `${weather.icon} · ${escapeHtml(weather.label)}`;
}

function worldStatusLines({ moon, daytime, weather } = {}) {
  return [
    formatWeatherLine(weather),
    formatMoonLine(moon),
    formatTimeLine(daytime),
  ].filter(Boolean);
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
    'Вайтлист. В общем чате группы любой участник может добавить себя или друзей.',
    '',
    '/whitelist list',
    '/whitelist add &lt;ник&gt; [ник…]',
    '/whitelist remove &lt;ник&gt; [ник…]',
  ].join('\n');
}

export function whitelistListText(whitelist) {
  if (!whitelist?.ok) {
    return whitelist?.raw ? escapeHtml(whitelist.raw) : 'Не удалось прочитать вайтлист.';
  }
  if (!whitelist.players.length) {
    return 'Вайтлист пуст.';
  }
  return `Вайтлист (${whitelist.count}): ${formatPlayerNames(whitelist.players)}`;
}

export function whitelistInvalidNicks(names) {
  return [
    'Ник — 1–16 символов: латиница, цифры и _.',
    `Не подошло: ${names.map(escapeHtml).join(', ')}`,
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

const ADVANCEMENT_VERBS = {
  advancement: 'получил достижение',
  challenge: 'выполнил испытание',
  goal: 'достиг цели',
};

export function advancementLine(event) {
  const info = resolveAdvancement(event.title);
  const verb = ADVANCEMENT_VERBS[event.kind] || ADVANCEMENT_VERBS.advancement;
  const title = `<a href="${escapeHtml(info.url)}">${escapeHtml(info.ru)}</a>`;
  return `${formatPlayerName(event.name)} ${verb} ${title}`;
}

export function chatRelayLine(name, message) {
  return `&lt;${formatPlayerName(name)}&gt; ${escapeHtml(message)}`;
}

export function musicEventLine(event) {
  const who = event.name ? formatPlayerName(event.name) : 'Кто-то';
  if (event.type === 'music_playlist' && event.playlist) {
    return `${who} включил плейлист «${escapeHtml(event.playlist)}»`;
  }
  if (event.title) {
    return `${who} включил музыку: ${escapeHtml(event.title)}`;
  }
  return `${who} включил музыку`;
}

export function kitText(name, title, labels) {
  const loot = labels.filter(Boolean).join(', ');
  return `${formatPlayerName(name)} · ${escapeHtml(title)}${loot ? `: ${escapeHtml(loot)}` : ''}`;
}

export function kitTellraw(title, labels) {
  const loot = labels.filter(Boolean).join(', ');
  return JSON.stringify({
    text: String(title || 'Набор'),
    color: 'green',
    extra: loot ? [{ text: `\n${loot}`, color: 'gold' }] : [],
  });
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

export function statusBoardText({ list, daytime, weather, moon, tps }) {
  const time = daytime?.phase === 'unknown' ? null : daytime;
  const lines = [
    `<b>${escapeHtml(config.server.motd)}</b>`,
    '',
    ...worldStatusLines({ weather, moon, daytime: time }),
  ];
  if (list?.ok) {
    const tpsLine = formatTpsLine(tps);
    if (tpsLine) {
      lines.push(tpsLine);
    }
  }
  lines.push('');
  if (!list?.ok) {
    lines.push(connectionLost());
    return lines.join('\n');
  }
  lines.push(`Игроки <b>${list.online}</b> / ${list.max}`);
  if (!list.players.length) {
    lines.push('На сервере нет игроков.');
    return lines.join('\n');
  }
  const shown = list.players.slice(0, 20);
  for (const name of shown) {
    lines.push(formatPlayerName(name));
  }
  if (list.players.length > shown.length) {
    lines.push(`… +${list.players.length - shown.length}`);
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

function formatDays(count) {
  const n = Math.max(1, Number(count) || 1);
  const n10 = n % 10;
  const n100 = n % 100;
  let word = 'дней';
  if (n100 < 11 || n100 > 14) {
    if (n10 === 1) {
      word = 'день';
    } else if (n10 >= 2 && n10 <= 4) {
      word = 'дня';
    }
  }
  return `${n} ${word}`;
}

export function emptyWorldText({ sinceLabel, hours, days }) {
  if (days) {
    return `Никто не заходил уже ${formatDays(days)} (пусто с ${escapeHtml(sinceLabel)}).`;
  }
  const duration = hours === 1 ? '1 ч' : `${hours} ч`;
  return `Мир пуст с ${escapeHtml(sinceLabel)} (уже ${duration}).`;
}

export function dailyRecapText({ dateLabel, players, deaths, advancements }) {
  const lines = [`<b>Итоги дня</b> · ${escapeHtml(dateLabel)}`];
  lines.push(players.length
    ? `Заходили: ${formatPlayerNames(players)}`
    : 'Сегодня никто не заходил.');
  lines.push(`Смертей: <b>${deaths}</b>`);
  lines.push(`Достижений: <b>${advancements}</b>`);
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

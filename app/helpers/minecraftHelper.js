export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripMcColor(text) {
  return String(text || '').replace(/§[0-9a-fk-or]/gi, '').trim();
}

export function commandArgs(ctx) {
  return (ctx.message?.text || '').replace(/^\/\S+\s*/, '').trim();
}

function splitPlayerNames(namesRaw) {
  return String(namesRaw || '')
    .split(',')
    .map((name) => name.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean);
}

export function parsePlayerList(raw) {
  const text = stripMcColor(raw).replace(/\s+/g, ' ').trim();
  const patterns = [
    /There are (\d+) of a max(?:imum)?(?: of)? (\d+) players online:?\s*(.*)$/i,
    /There are (\d+)\/(\d+) players online:?\s*(.*)$/i,
    /Сейчас на сервере (\d+) из (\d+) игроков:?\s*(.*)$/i,
    /(\d+)\s*(?:of a max(?:imum)?(?: of)?|из|\/)\s*(\d+)\s*(?:players online|игроков)\s*:?\s*(.*)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    return {
      ok: true,
      online: Number(match[1]),
      max: Number(match[2]),
      players: splitPlayerNames(match[3]),
      raw: text,
    };
  }

  return {
    ok: false, online: 0, max: 0, players: [], raw: text,
  };
}

export function parseTimeQuery(raw) {
  const text = stripMcColor(raw);
  const match = text.match(/(-?\d+)/);
  return match ? Number(match[1]) : null;
}

const TICKS_PER_DAY = 24000;

export function describeDaytime(ticks) {
  if (ticks == null || Number.isNaN(ticks)) {
    return { label: 'Неизвестно', icon: '❔', phase: 'unknown' };
  }

  const t = ((ticks % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;

  if (t >= 23000 || t < 1000) {
    return { label: 'Рассвет', icon: '🌅', phase: 'sunrise', ticks: t };
  }
  if (t < 6000) {
    return { label: 'Утро', icon: '🌤️', phase: 'morning', ticks: t };
  }
  if (t < 9000) {
    return { label: 'Полдень', icon: '☀️', phase: 'noon', ticks: t };
  }
  if (t < 12000) {
    return { label: 'День', icon: '☀️', phase: 'day', ticks: t };
  }
  if (t < 13000) {
    return { label: 'Закат', icon: '🌇', phase: 'sunset', ticks: t };
  }
  if (t < 18000) {
    return { label: 'Ночь', icon: '🌙', phase: 'night', ticks: t };
  }
  return { label: 'Полночь', icon: '🌑', phase: 'midnight', ticks: t };
}

export function formatPlayerNames(players) {
  if (!players.length) {
    return 'нет игроков';
  }
  return players.map((name) => `<code>${escapeHtml(name)}</code>`).join(', ');
}

export function parseTps(raw) {
  const text = stripMcColor(raw);
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => m[1]);
  if (nums.length < 3) {
    return text || null;
  }
  return nums.slice(-3).join(', ');
}

const DIFFICULTY_LABELS = {
  peaceful: 'Мирная',
  easy: 'Лёгкая',
  normal: 'Нормальная',
  hard: 'Сложная',
};

const WEATHER_LABELS = {
  clear: 'Ясно',
  rain: 'Дождь',
  thunder: 'Гроза',
};

const TIME_SET_LABELS = {
  day: 'День',
  noon: 'Полдень',
  night: 'Ночь',
  midnight: 'Полночь',
};

export function difficultyLabel(key) {
  if (!key) {
    return null;
  }
  return DIFFICULTY_LABELS[String(key).toLowerCase()] || key;
}

export function weatherLabel(key) {
  return WEATHER_LABELS[String(key).toLowerCase()] || null;
}

export function timeSetLabel(key) {
  return TIME_SET_LABELS[String(key).toLowerCase()] || null;
}

export function parseSeed(raw) {
  const text = stripMcColor(raw);
  const match = text.match(/(-?\d{2,})/);
  return match ? match[1] : null;
}

export function parseDifficulty(raw) {
  const text = stripMcColor(raw);
  const match = text.match(/\b(peaceful|easy|normal|hard)\b/i);
  return match ? difficultyLabel(match[1]) : (text || null);
}

const CHAT_LINE = /^(?:\[Not Secure\] )?<(?<name>[^>]+)> (?<message>.+)$/;
const SERVER_SAY = /^\[Server\] (?<message>.+)$/;
const JOIN_LINE = /^(?<name>.+?) (?:joined the game|присоединил(?:ся|ась) к игре)$/;
const LEAVE_LINE = /^(?<name>.+?) (?:left the game|выш(?:ел|ла) из игры)$/;

export function stripLogPayload(raw) {
  const text = stripMcColor(raw).trim();
  if (!text) {
    return '';
  }
  const prefixed = text.match(/^\[.+?\] \[.+?\]: (.*)$/)
    || text.match(/^\[.+?\]: (.*)$/);
  return (prefixed ? prefixed[1] : text).trim();
}

export function parseJoinLeaveLine(raw) {
  const payload = stripLogPayload(raw);
  if (!payload) {
    return null;
  }

  const joined = payload.match(JOIN_LINE);
  if (joined?.groups?.name) {
    return { type: 'join', name: joined.groups.name.trim() };
  }

  const left = payload.match(LEAVE_LINE);
  if (left?.groups?.name) {
    return { type: 'leave', name: left.groups.name.trim() };
  }

  return null;
}

export function parseChatLine(raw) {
  const payload = stripLogPayload(raw);
  if (!payload) {
    return null;
  }

  const chat = payload.match(CHAT_LINE);
  if (chat?.groups?.name && chat.groups.message) {
    return { name: chat.groups.name.trim(), message: chat.groups.message.trim() };
  }

  const say = payload.match(SERVER_SAY);
  if (say?.groups?.message) {
    return { name: 'Server', message: say.groups.message.trim() };
  }

  return null;
}

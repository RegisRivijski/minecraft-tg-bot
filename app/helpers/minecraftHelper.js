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
  if (!text || /incorrect argument|unknown or incomplete|syntax error|unexpected argument/i.test(text)) {
    return null;
  }

  const labeled = text.match(/time is (-?\d+)/i)
    || text.match(/время[:\s]+(-?\d+)/i)
    || text.match(/args=\[(-?\d+)/i);
  if (labeled) {
    return Number(labeled[1]);
  }

  const match = text.match(/(-?\d+)/);
  return match ? Number(match[1]) : null;
}

const TICKS_PER_DAY = 24000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function ticksToClock(ticks) {
  const t = ((ticks % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  const hours = (Math.floor(t / 1000) + 6) % 24;
  const minutes = Math.floor((t % 1000) * 60 / 1000);
  return `${pad2(hours)}:${pad2(minutes)}`;
}

export function describeDaytime(ticks) {
  if (ticks == null || Number.isNaN(ticks)) {
    return {
      label: 'Неизвестно', icon: '❔', phase: 'unknown', clock: null, name: null,
    };
  }

  const t = ((ticks % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  const clock = ticksToClock(t);
  let name;
  let icon;
  let phase;

  if (t >= 23000 || t < 1000) {
    name = 'Рассвет';
    icon = '🌅';
    phase = 'sunrise';
  } else if (t < 6000) {
    name = 'Утро';
    icon = '🌤️';
    phase = 'morning';
  } else if (t < 9000) {
    name = 'Полдень';
    icon = '☀️';
    phase = 'noon';
  } else if (t < 12000) {
    name = 'День';
    icon = '☀️';
    phase = 'day';
  } else if (t < 13000) {
    name = 'Закат';
    icon = '🌇';
    phase = 'sunset';
  } else if (t < 18000) {
    name = 'Ночь';
    icon = '🌙';
    phase = 'night';
  } else {
    name = 'Полночь';
    icon = '🌑';
    phase = 'midnight';
  }

  return {
    label: `${clock} · ${name}`,
    icon,
    phase,
    ticks: t,
    clock,
    name,
  };
}

export function formatPlayerNames(players) {
  if (!players.length) {
    return 'нет игроков';
  }
  return players.map((name) => `<code>${escapeHtml(name)}</code>`).join(', ');
}

export function parseTps(raw) {
  const text = stripMcColor(raw);
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (!nums.length) {
    return null;
  }
  const values = nums.length >= 3 ? nums.slice(-3) : nums;
  return values[0];
}

export function describeTps(tps) {
  if (tps == null || Number.isNaN(Number(tps))) {
    return null;
  }
  const value = Number(tps);
  if (value >= 19.5) {
    return 'Сервер работает плавно';
  }
  if (value >= 18) {
    return `Небольшие лаги (${value.toFixed(1)} TPS)`;
  }
  if (value >= 15) {
    return `Сервер лагает (${value.toFixed(1)} TPS)`;
  }
  return `Сильные лаги (${value.toFixed(1)} TPS)`;
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

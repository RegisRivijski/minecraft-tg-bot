// Telegram HTML and command text
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripMcColor(text) {
  return String(text || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/§[0-9a-fk-or]/gi, '')
    .trim();
}

export function commandArgs(ctx) {
  return (ctx.message?.text || '').replace(/^\/\S+\s*/, '').trim();
}

// RCON: player list
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

// RCON: time of day
export function parseTimeQuery(raw) {
  const text = stripMcColor(raw);
  if (!text || /incorrect argument|unknown or incomplete|syntax error|unexpected argument/i.test(text)) {
    return null;
  }

  const labeledMatch = text.match(/time is (-?\d+)/i)
    || text.match(/время[:\s]+(-?\d+)/i)
    || text.match(/args=\[(-?\d+)/i);
  if (labeledMatch) {
    return Number(labeledMatch[1]);
  }

  const numberMatch = text.match(/(-?\d+)/);
  return numberMatch ? Number(numberMatch[1]) : null;
}

export const TICKS_PER_DAY = 24000;

export function normalizeDayTicks(ticks) {
  return ((ticks % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function ticksToClock(ticks) {
  const dayTicks = normalizeDayTicks(ticks);
  const hours = (Math.floor(dayTicks / 1000) + 6) % 24;
  const minutes = Math.floor((dayTicks % 1000) * 60 / 1000);
  return `${pad2(hours)}:${pad2(minutes)}`;
}

export function describeDaytime(ticks) {
  if (ticks == null || Number.isNaN(ticks)) {
    return {
      label: 'Неизвестно', icon: '❔', phase: 'unknown', clock: null, name: null,
    };
  }

  const dayTicks = normalizeDayTicks(ticks);
  const clock = ticksToClock(dayTicks);
  let name;
  let icon;
  let phase;

  if (dayTicks >= 23000 || dayTicks < 1000) {
    name = 'Рассвет';
    icon = '🌅';
    phase = 'sunrise';
  } else if (dayTicks < 6000) {
    name = 'Утро';
    icon = '🌤️';
    phase = 'morning';
  } else if (dayTicks < 9000) {
    name = 'Полдень';
    icon = '☀️';
    phase = 'noon';
  } else if (dayTicks < 12000) {
    name = 'День';
    icon = '☀️';
    phase = 'day';
  } else if (dayTicks < 13000) {
    name = 'Закат';
    icon = '🌇';
    phase = 'sunset';
  } else if (dayTicks < 18000) {
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
    ticks: dayTicks,
    clock,
    name,
  };
}

const MOON_PHASES = [
  { key: 'full', icon: '🌕', label: 'Полная луна' },
  { key: 'waning_gibbous', icon: '🌖', label: 'Убывающая луна' },
  { key: 'third_quarter', icon: '🌗', label: 'Последняя четверть' },
  { key: 'waning_crescent', icon: '🌘', label: 'Старая луна' },
  { key: 'new', icon: '🌑', label: 'Новолуние' },
  { key: 'waxing_crescent', icon: '🌒', label: 'Молодая луна' },
  { key: 'first_quarter', icon: '🌓', label: 'Первая четверть' },
  { key: 'waxing_gibbous', icon: '🌔', label: 'Растущая луна' },
];

export function describeMoonPhase(dayNumber) {
  if (dayNumber == null || Number.isNaN(Number(dayNumber))) {
    return null;
  }
  const day = Math.floor(Number(dayNumber));
  const phase = ((day % 8) + 8) % 8;
  return { day, phase, ...MOON_PHASES[phase] };
}

export function isNotableMoonPhase(moon) {
  return moon?.key === 'full' || moon?.key === 'new';
}

export function formatPlayerName(name) {
  return `<i><code>${escapeHtml(name)}</code></i>`;
}

export function formatPlayerNames(players) {
  if (!players.length) {
    return 'нет игроков';
  }
  return players.map(formatPlayerName).join(', ');
}

// RCON: TPS
export function parseTps(raw) {
  const text = stripMcColor(raw);
  const numbers = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  if (!numbers.length) {
    return null;
  }
  const window = numbers.length >= 3 ? numbers.slice(-3) : numbers;
  return window[0];
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

// World labels
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

const WEATHER_ICONS = {
  clear: '🌤️',
  rain: '🌧️',
  thunder: '⛈️',
};

export function describeWeather(key) {
  const id = String(key || '').toLowerCase();
  const label = WEATHER_LABELS[id];
  if (!label) {
    return null;
  }
  return { key: id, label, icon: WEATHER_ICONS[id] };
}

const EXECUTE_FAIL = /test failed|проверка не пройдена/i;
const EXECUTE_PASS = /test passed|проверка пройдена/i;
const COMMAND_ERROR = /incorrect argument|unknown or incomplete|syntax error|unexpected argument|unknown command|failed to parse|could not parse|malformed/i;

export function parseWeatherQuery(raw) {
  const text = stripMcColor(raw);
  if (!text || COMMAND_ERROR.test(text) || /usage:/i.test(text)) {
    return null;
  }
  if (/\b(thunder|thundering|storm|гроза)\b/i.test(text)) {
    return 'thunder';
  }
  if (/\b(rain|raining|дождь)\b/i.test(text)) {
    return 'rain';
  }
  if (/\b(clear|clearing|ясно)\b/i.test(text)) {
    return 'clear';
  }
  return null;
}

export function parseWeatherCheck(raw) {
  const text = stripMcColor(raw);
  if (COMMAND_ERROR.test(text) || /cannot be|not allowed|failed to parse/i.test(text)) {
    return null;
  }
  if (EXECUTE_FAIL.test(text)) {
    return false;
  }
  if (!text || EXECUTE_PASS.test(text)) {
    return true;
  }
  return null;
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

// latest.log: chat, join/leave, deaths, advancements
const CHAT_LINE = /^(?:\[Not Secure\] )?<(?<name>[^>]+)> (?<message>.+)$/;
const SERVER_SAY = /^\[Server\] (?<message>.+)$/;
const JOIN_LINE = /^(?<name>.+?) (?:joined the game|присоединил(?:ся|ась) к игре)$/;
const LEAVE_LINE = /^(?<name>.+?) (?:left the game|выш(?:ел|ла) из игры)$/;

export function stripLogPayload(raw) {
  const text = stripMcColor(raw).trim();
  if (!text) {
    return '';
  }

  const prefixMatch = text.match(/^\[.+?\] \[.+?\]: (.*)$/)
    || text.match(/^\[[0-9:.\s]+(?:\s+\w+)?\]: (.*)$/)
    || text.match(/^\[[^\]]+\]: (.*)$/);
  return (prefixMatch ? prefixMatch[1] : text).trim();
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

const UUID_LINE = /^UUID of player (?<name>.+?) is (?<uuid>[0-9a-f-]{32,36})$/i;
const NIGHT_SKIP_LINE = [
  /^Skipping the night/i,
  /^Sleeping through this night/i,
  /^The night has been skipped/i,
  /^Пропускаем ночь/i,
  /^Ночь (будет )?пропущена/i,
];
const SERVER_STARTED = /^Done \(/;
const SERVER_STOPPING = /^Stopping (the )?server/i;

export function parsePlayerUuidLine(raw) {
  const payload = stripLogPayload(raw);
  if (!payload) {
    return null;
  }
  const match = payload.match(UUID_LINE);
  if (!match?.groups?.name || !match.groups.uuid) {
    return null;
  }
  return { name: match.groups.name.trim(), uuid: match.groups.uuid.trim() };
}

export function parseNightSkipLine(raw) {
  const payload = stripLogPayload(raw);
  if (!payload || !NIGHT_SKIP_LINE.some((pattern) => pattern.test(payload))) {
    return null;
  }
  return { type: 'night_skip', text: payload };
}

export function parseServerLifecycleLine(raw) {
  const payload = stripLogPayload(raw);
  if (!payload) {
    return null;
  }
  if (SERVER_STARTED.test(payload)) {
    return { type: 'server_up', text: payload };
  }
  if (SERVER_STOPPING.test(payload)) {
    return { type: 'server_down', text: payload };
  }
  return null;
}

const EVENT_NOISE = [
  /^UUID of player /,
  / logged in with entity id /,
  / lost connection: /,
  /^Thread RCON /,
  /^RCON /,
  /^Saving /,
  /^Saved /,
  /^Can't keep up/,
  /^Disconnecting /,
  /^Stopping /,
  /^Starting /,
  /^Loading /,
  /^Preparing /,
  /^Done \(/,
  /^Generating /,
  /moved too quickly/,
  /^Issued server command/,
  /^Unknown or incomplete command/,
  /^Incorrect argument/,
  /^com\./,
  /^\s*at /,
  /^Caused by:/,
];

const ADVANCEMENT_LINE = [
  /^(?<name>.+?) has made the advancement \[(?<title>.+)\]$/,
  /^(?<name>.+?) has completed the challenge \[(?<title>.+)\]$/,
  /^(?<name>.+?) has reached the goal \[(?<title>.+)\]$/,
  /^(?<name>.+?) получил(?:а)? достижение \[(?<title>.+)\]$/,
  /^(?<name>.+?) выполнил(?:а)? задание \[(?<title>.+)\]$/,
  /^(?<name>.+?) достиг(?:ла)? цели \[(?<title>.+)\]$/,
];

const DEATH_LINE = [
  / was slain /,
  / was shot /,
  / was blown up/,
  / was killed /,
  / drowned/,
  / burned to death/,
  / went up in flames/,
  / walked into (a )?fire/,
  / fell from a high place/,
  / fell off /,
  / fell out of the world/,
  / hit the ground too hard/,
  / was squashed /,
  / was squished /,
  / starved to death/,
  / suffocated/,
  / withered away/,
  / was pricked to death/,
  / walked into a cactus/,
  / experienced kinetic energy/,
  / blew up/,
  / tried to swim in lava/,
  / discovered (the )?floor was lava/,
  / went off with a bang/,
  / was poked to death/,
  / was impaled/,
  / was doomed to fall/,
  / didn't want to live in the same world as /,
  / was fireballed /,
  / was stung to death/,
  / froze to death/,
  / was skewered/,
  / was struck by lightning/,
  / was obliterated by a sonically-charged shriek/,
  / left the confines of this world/,
  / was roasted in dragon breath/,
  / was pummeled by/,
  / walked into danger zone/,
  / was impaled on a stalagmite/,
  / fell too far/,
  / was squashed by a falling/,
  / was killed by magic/,
  / was killed by even more magic/,
  / died$/,
  / был(?:а)? убит/,
  / застрелен/,
  / застрелена/,
  / утонул/,
  / утонула/,
  / сгорел/,
  / сгорела/,
  / упал(?:а)? с высоты/,
  / умер(?:ла)? от голода/,
  / задохнул(?:ся|ась)/,
  / взорвал(?:ся|ась)/,
  / погиб(?:ла)?/,
  / ударила молния/,
  / заморожен/,
];

const ENTITY_DUMP = /^(?:[A-Za-z0-9_:]+ )?(?<type>[A-Za-z0-9_:]+)\['[^']*'\/\d+, uuid='[^']+'/;
const QUOTED_DEATH = / died, message: '(?<message>.*)'\s*$/;
const NAMED_ENTITY = /^Named entity (?<type>[^\s\[']+)/i;
const NAMED_ENTITY_NAME = /\['(?<name>[^']+)'/;
const PLAYER_NICK = /^[A-Za-z0-9_]{1,16} /;

const PET_TYPE_LABELS = {
  wolf: 'волк',
  cat: 'кошка',
  ocelot: 'оцелот',
  parrot: 'попугай',
  horse: 'лошадь',
  donkey: 'осёл',
  mule: 'мул',
  llama: 'лама',
  trader_llama: 'лама',
  fox: 'лиса',
  allay: 'аллай',
  axolotl: 'аксолотль',
  camel: 'верблюд',
  sniffer: 'нюхач',
  iron_golem: 'железный голем',
  snow_golem: 'снежный голем',
  villager: 'житель',
  wandering_trader: 'странствующий торговец',
  frog: 'лягушка',
  bee: 'пчела',
  goat: 'коза',
};

export function petTypeLabel(entityType) {
  const raw = String(entityType || '')
    .replace(/^minecraft:/i, '')
    .replace(/^entity\.minecraft\./i, '')
    .replace(/^craft/i, '')
    .replace(/^entity/i, '');
  const key = raw.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  return PET_TYPE_LABELS[key] || (key ? key.replace(/_/g, ' ') : null);
}

function isPlayerEntityType(type) {
  const key = String(type || '').toLowerCase();
  return key === 'player'
    || key === 'serverplayer'
    || key === 'craftplayer'
    || key === 'minecraft:player'
    || key.endsWith(':player');
}

function namedEntityDeathText(payload) {
  const quoted = payload.match(QUOTED_DEATH);
  if (quoted?.groups?.message) {
    return quoted.groups.message.trim();
  }
  const afterDied = payload.replace(/^Named entity \S+.+? died:\s*/i, '').trim();
  return afterDied && afterDied !== payload ? afterDied : null;
}

export function parseNamedMobDeath(payload) {
  const named = payload.match(NAMED_ENTITY);
  if (!named || isPlayerEntityType(named.groups.type)) {
    return null;
  }
  const text = namedEntityDeathText(payload);
  if (!text) {
    return null;
  }
  const name = payload.match(NAMED_ENTITY_NAME)?.groups?.name?.trim()
    || text.split(' ', 1)[0];
  return {
    type: 'pet_death',
    name,
    entityType: named.groups.type,
    text,
  };
}

function unwrapEntityDeath(payload) {
  const quoted = payload.match(QUOTED_DEATH);
  const dump = payload.match(ENTITY_DUMP);
  const named = payload.match(NAMED_ENTITY);

  if (named) {
    if (!isPlayerEntityType(named.groups.type)) {
      return null;
    }
    return namedEntityDeathText(payload);
  }

  if (dump) {
    if (!isPlayerEntityType(dump.groups.type)) {
      return null;
    }
    return quoted?.groups?.message || null;
  }

  if (quoted) {
    return quoted.groups.message;
  }

  return payload;
}

export function parseWorldEventLine(raw) {
  const stripped = stripLogPayload(raw);
  if (!stripped || EVENT_NOISE.some((pattern) => pattern.test(stripped))) {
    return null;
  }

  const pet = parseNamedMobDeath(stripped);
  if (pet) {
    return pet;
  }

  const payload = unwrapEntityDeath(stripped);
  if (!payload) {
    return null;
  }

  for (const pattern of ADVANCEMENT_LINE) {
    const match = payload.match(pattern);
    if (match?.groups?.name) {
      return {
        type: 'advancement',
        name: match.groups.name.trim(),
        title: match.groups.title?.trim() || '',
        text: payload,
      };
    }
  }

  // Death messages start with a Minecraft nick; skip everything else.
  if (!PLAYER_NICK.test(payload)) {
    return null;
  }

  if (DEATH_LINE.some((pattern) => pattern.test(payload))) {
    const name = payload.split(' ', 1)[0];
    return { type: 'death', name, text: payload };
  }

  return null;
}

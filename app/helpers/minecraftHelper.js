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

export function speakerName(ctx) {
  const senderChat = ctx.message?.sender_chat;
  if (senderChat?.title) {
    return String(senderChat.title).replace(/[\r\n]+/g, ' ').trim();
  }
  const from = ctx.from || {};
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
    || from.username
    || String(from.id || 'Telegram');
  return String(name).replace(/[\r\n]+/g, ' ').trim();
}

function splitPlayerNames(namesRaw) {
  return String(namesRaw || '')
    .split(',')
    .map((name) => name.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean);
}

function listedPlayerNames(namesRaw, online) {
  if (!Number.isFinite(online) || online <= 0) {
    return [];
  }
  return splitPlayerNames(namesRaw).filter(isMinecraftNick);
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
    const online = Number(match[1]);
    return {
      ok: true,
      online,
      max: Number(match[2]),
      players: listedPlayerNames(match[3], online),
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
    icon = '🌄';
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
    icon = '🌃';
    phase = 'night';
  } else {
    name = 'Полночь';
    icon = '🌌';
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

export function formatPlayerName(name) {
  return `<i><code>${escapeHtml(name)}</code></i>`;
}

export function isMinecraftNick(name) {
  return /^[A-Za-z0-9_]{1,16}$/.test(String(name || ''));
}

export function formatPlayerNames(players) {
  if (!players.length) {
    return 'нет игроков';
  }
  return players.map(formatPlayerName).join(', ');
}

const EXECUTE_FAIL = /test failed|проверка не пройдена/i;
const EXECUTE_PASS = /test passed|проверка пройдена/i;
const COMMAND_ERROR = /incorrect argument|unknown or incomplete|syntax error|unexpected argument|unknown command|failed to parse|could not parse|malformed/i;
const GIVE_FAIL = /no player was found|no entity was found|unknown item|player .+ was not found/i;

export function parseGiveResult(raw) {
  const text = stripMcColor(raw);
  if (COMMAND_ERROR.test(text) || GIVE_FAIL.test(text)) {
    return false;
  }
  return true;
}

const EASYAUTH_LOGIN_OK = /(?:\[LOGIN\]:\s*)?Player (?<name>[A-Za-z0-9_]{1,16}) provide[ds]? correct password/i;
const EASYAUTH_REGISTER_OK = /(?:\[REGISTER\]:\s*)?Player (?<name>[A-Za-z0-9_]{1,16})(?:\{[^}]*\})? successfully registered/i;

export function parseEasyAuthLine(raw) {
  const payload = stripLogPayload(raw);
  if (!payload || !/\[EasyAuth\]/i.test(payload)) {
    return null;
  }

  const login = payload.match(EASYAUTH_LOGIN_OK);
  if (login?.groups?.name) {
    return { type: 'login', name: login.groups.name };
  }

  const registered = payload.match(EASYAUTH_REGISTER_OK);
  if (registered?.groups?.name) {
    return { type: 'register', name: registered.groups.name };
  }

  return null;
}

// RCON: TPS
export function parseTpsWindows(raw) {
  const text = stripMcColor(raw);
  if (!text || COMMAND_ERROR.test(text)) {
    return null;
  }

  // Paper: "TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0"
  // Spark: numbers on the next line after "TPS from last 5s, 10s, …:"
  // Do not scan the rest of the report — idle tick duration / CPU is ~1.0.
  const header = text.match(/TPS from last[^\n]*:/i);
  if (!header) {
    return null;
  }
  const after = text.slice(header.index + header[0].length);
  const section = after.split(/\n\s*(?:Tick durations|CPU usage|MSPT|Memory usage)\b/i)[0];
  const windows = [...section.matchAll(/(\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value <= 21);
  if (!windows.length) {
    return null;
  }
  const shown = windows.length > 3 ? windows.slice(-3) : windows;
  return { current: shown[0], windows: shown };
}

export function parseTps(raw) {
  return parseTpsWindows(raw)?.current ?? null;
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
  // Require the Seed: label. A bare first number is often Spark TPS ("20.0").
  const match = text.match(/\bseed\b[:\s]*\[?\s*(-?\d+)\s*\]?/i);
  return match ? match[1] : null;
}

export function parseDifficulty(raw) {
  const text = stripMcColor(raw);
  const match = text.match(/\b(peaceful|easy|normal|hard)\b/i);
  return match ? difficultyLabel(match[1]) : (text || null);
}

export function parseGamerule(raw) {
  const text = stripMcColor(raw);
  if (!text || COMMAND_ERROR.test(text)) {
    return null;
  }
  const bool = text.match(/\b(true|false)\b/i);
  if (bool) {
    return bool[1].toLowerCase() === 'true';
  }
  const number = text.match(/(-?\d+(?:\.\d+)?)\s*$/);
  if (number) {
    return Number(number[1]);
  }
  return null;
}

export function parseWhitelistList(raw) {
  const text = stripMcColor(raw).replace(/\s+/g, ' ').trim();
  if (!text || COMMAND_ERROR.test(text)) {
    return { ok: false, count: 0, players: [], raw: text };
  }
  if (/no whitelisted|нет[^\n]*(вайтлист|белом списке|белого списка)|вайтлист пуст/i.test(text)) {
    return { ok: true, count: 0, players: [], raw: text };
  }

  const countMatch = text.match(/(?:there are|there is)\s+(\d+)\s+whitelisted player/i)
    || text.match(/(\d+)\s+(?:игрок(?:а|ов)?|игроков)/i);
  const namesPart = text.includes(':') ? text.slice(text.indexOf(':') + 1) : '';
  const players = splitPlayerNames(namesPart);
  const count = countMatch ? Number(countMatch[1]) : players.length;
  return {
    ok: true,
    count,
    players,
    raw: text,
  };
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
    const name = joined.groups.name.trim();
    if (isMinecraftNick(name)) {
      return { type: 'join', name };
    }
  }

  const left = payload.match(LEAVE_LINE);
  if (left?.groups?.name) {
    const name = left.groups.name.trim();
    if (isMinecraftNick(name)) {
      return { type: 'leave', name };
    }
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

// Simple Voice Chat Music Addon — system chat / server log
const MUSIC_STARTED_PLAYBACK = /^\[Music\] (?<name>.+?) started playback(?: at volume (?<volume>\d+))?$/;
const MUSIC_STARTED_PLAYLIST = /^\[Music\] (?<name>.+?) started playlist (?<playlist>.+)$/;
const MUSIC_NOW_PLAYING = /^\[Music\] Now playing(?: next)?: (?<title>.+?)(?: \(requested by (?<name>.+)\))?$/;
const MUSIC_PLAYING_PLAYLIST = /^\[Music\] Playing playlist (?<playlist>.+)$/;

export function parseMusicEventLine(raw) {
  const payload = stripLogPayload(raw);
  if (!payload || !payload.startsWith('[Music]')) {
    return null;
  }

  const started = payload.match(MUSIC_STARTED_PLAYBACK);
  if (started?.groups?.name) {
    return {
      type: 'music_started',
      name: started.groups.name.trim(),
      volume: started.groups.volume ? Number(started.groups.volume) : null,
    };
  }

  const playlist = payload.match(MUSIC_STARTED_PLAYLIST);
  if (playlist?.groups?.name && playlist.groups.playlist) {
    return {
      type: 'music_playlist',
      name: playlist.groups.name.trim(),
      playlist: playlist.groups.playlist.trim(),
    };
  }

  const playingPlaylist = payload.match(MUSIC_PLAYING_PLAYLIST);
  if (playingPlaylist?.groups?.playlist) {
    return {
      type: 'music_playlist',
      name: null,
      playlist: playingPlaylist.groups.playlist.trim(),
    };
  }

  const nowPlaying = payload.match(MUSIC_NOW_PLAYING);
  if (nowPlaying?.groups?.title) {
    return {
      type: 'music_now_playing',
      title: nowPlaying.groups.title.trim(),
      name: nowPlaying.groups.name?.trim() || null,
    };
  }

  return null;
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
  { kind: 'advancement', pattern: /^(?<name>.+?) has made the advancement \[(?<title>.+)\]$/ },
  { kind: 'challenge', pattern: /^(?<name>.+?) has completed the challenge \[(?<title>.+)\]$/ },
  { kind: 'goal', pattern: /^(?<name>.+?) has reached the goal \[(?<title>.+)\]$/ },
  { kind: 'advancement', pattern: /^(?<name>.+?) получил(?:а)? достижение \[(?<title>.+)\]$/ },
  { kind: 'challenge', pattern: /^(?<name>.+?) выполнил(?:а)? задание \[(?<title>.+)\]$/ },
  { kind: 'challenge', pattern: /^(?<name>.+?) выполнил(?:а)? испытание \[(?<title>.+)\]$/ },
  { kind: 'goal', pattern: /^(?<name>.+?) достиг(?:ла)? цели \[(?<title>.+)\]$/ },
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
  / fell while climbing/,
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

  for (const { kind, pattern } of ADVANCEMENT_LINE) {
    const match = payload.match(pattern);
    if (match?.groups?.name) {
      return {
        type: 'advancement',
        kind,
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

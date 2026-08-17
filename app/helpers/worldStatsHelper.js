import fs from 'node:fs/promises';
import path from 'node:path';

import config from '../../config/default.js';

const WEEKDAYS = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const TOP_LIMIT = 5;
const SAVE_DEBOUNCE_MS = 400;

let state = blankState();
let loaded = false;
let saveTimer = null;
let previousOnline = null;

function timeZone() {
  return config.server.timeZone || 'Europe/Kyiv';
}

export function zonedParts(date = new Date()) {
  const map = {};
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return map;
}

export function weekdayNumber(parts = zonedParts()) {
  return WEEKDAYS[parts.weekday] ?? 0;
}

function dateKey(parts = zonedParts()) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function digestHourKey(parts = zonedParts()) {
  return `${dateKey(parts)}-${parts.hour}`;
}

function isoWeekKey(parts = zonedParts()) {
  const utc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function emptyDay(key) {
  return {
    key, joined: {}, deaths: {}, advancements: {}, playMs: {},
  };
}

function emptyWeek(key) {
  return {
    key, deaths: {}, playMs: {},
  };
}

function blankState() {
  const parts = zonedParts();
  return {
    knownPlayers: {},
    day: emptyDay(dateKey(parts)),
    week: emptyWeek(isoWeekKey(parts)),
    empty: { since: null, notifiedAt: null },
    lastDailyPosted: null,
    lastWeeklyPosted: null,
    lastDigestPosted: null,
    lastMoonPosted: null,
    sessions: {},
  };
}

function normalizeUuid(uuid) {
  return String(uuid || '').toLowerCase().replace(/-/g, '');
}

function rotateBucketsIfNeeded() {
  const parts = zonedParts();
  const today = dateKey(parts);
  const week = isoWeekKey(parts);
  if (state.day?.key === today && state.week?.key === week) {
    return;
  }

  foldOpenSessions();
  if (state.day?.key !== today) {
    state.day = emptyDay(today);
  }
  if (state.week?.key !== week) {
    state.week = emptyWeek(week);
  }
}

function foldOpenSessions(now = Date.now()) {
  for (const [name, started] of Object.entries(state.sessions || {})) {
    const delta = Math.max(0, now - started);
    state.day.playMs[name] = (state.day.playMs[name] || 0) + delta;
    state.week.playMs[name] = (state.week.playMs[name] || 0) + delta;
    state.sessions[name] = now;
  }
}

function markJoined(name) {
  const key = String(name);
  state.day.joined[key] = true;
}

function bump(map, name, amount = 1) {
  const key = String(name);
  map[key] = (map[key] || 0) + amount;
}

function scheduleSave() {
  if (saveTimer) {
    return;
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeStats().catch((err) => console.warn('[stats]', err.message));
  }, SAVE_DEBOUNCE_MS);
}

async function writeStats() {
  const file = config.server.statsPath;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const payload = {
    knownPlayers: state.knownPlayers,
    day: state.day,
    week: state.week,
    empty: state.empty,
    lastDailyPosted: state.lastDailyPosted,
    lastWeeklyPosted: state.lastWeeklyPosted,
    lastDigestPosted: state.lastDigestPosted,
    lastMoonPosted: state.lastMoonPosted,
  };
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.rename(tmp, file);
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[stats] read', file, err.message);
    }
    return null;
  }
}

function parseMoonPosted(raw) {
  const day = Number(raw?.day);
  const key = String(raw?.key || '');
  if (!Number.isFinite(day) || !key) {
    return null;
  }
  return { day, key };
}

function mergeLoaded(raw) {
  const next = blankState();
  if (!raw || typeof raw !== 'object') {
    return next;
  }
  if (raw.knownPlayers && typeof raw.knownPlayers === 'object') {
    for (const [uuid, name] of Object.entries(raw.knownPlayers)) {
      const id = normalizeUuid(uuid);
      if (id && name) {
        next.knownPlayers[id] = String(name);
      }
    }
  }
  if (raw.day?.key) {
    next.day = { ...emptyDay(raw.day.key), ...raw.day };
  }
  if (raw.week?.key) {
    next.week = { ...emptyWeek(raw.week.key), ...raw.week };
  }
  if (raw.empty && typeof raw.empty === 'object') {
    next.empty = {
      since: raw.empty.since || null,
      notifiedAt: raw.empty.notifiedAt || null,
    };
  }
  next.lastDailyPosted = raw.lastDailyPosted || null;
  next.lastWeeklyPosted = raw.lastWeeklyPosted || null;
  next.lastDigestPosted = raw.lastDigestPosted || null;
  next.lastMoonPosted = parseMoonPosted(raw.lastMoonPosted);
  next.sessions = {};
  return next;
}

async function seedUsercache() {
  const cache = await readJson(config.server.usercachePath);
  if (!Array.isArray(cache)) {
    return 0;
  }
  let added = 0;
  for (const entry of cache) {
    const uuid = normalizeUuid(entry?.uuid);
    const name = String(entry?.name || '').trim();
    if (!uuid || !name || state.knownPlayers[uuid]) {
      continue;
    }
    state.knownPlayers[uuid] = name;
    added += 1;
  }
  return added;
}

export async function initWorldStats() {
  if (loaded) {
    return;
  }
  const stored = await readJson(config.server.statsPath);
  state = mergeLoaded(stored);
  state.sessions = {};
  previousOnline = null;
  rotateBucketsIfNeeded();
  const seeded = await seedUsercache();
  loaded = true;
  await writeStats().catch((err) => console.warn('[stats]', err.message));
  console.info(`[stats] ${Object.keys(state.knownPlayers).length} known players${seeded ? `, +${seeded} from usercache` : ''} path=${config.server.statsPath}`);
}

export async function flushWorldStats() {
  if (!loaded) {
    return;
  }
  rotateBucketsIfNeeded();
  foldOpenSessions();
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await writeStats().catch((err) => console.warn('[stats]', err.message));
}

export function notePlayerUuid(uuid, name) {
  rotateBucketsIfNeeded();
  const id = normalizeUuid(uuid);
  const nick = String(name || '').trim();
  if (!id || !nick) {
    return false;
  }
  if (state.knownPlayers[id]) {
    state.knownPlayers[id] = nick;
    scheduleSave();
    return false;
  }
  state.knownPlayers[id] = nick;
  markJoined(nick);
  scheduleSave();
  return true;
}

export function recordJoin(name) {
  if (!name) {
    return;
  }
  rotateBucketsIfNeeded();
  markJoined(name);
  scheduleSave();
}

export function recordDeath(name) {
  if (!name) {
    return;
  }
  rotateBucketsIfNeeded();
  bump(state.day.deaths, name);
  bump(state.week.deaths, name);
  scheduleSave();
}

export function recordAdvancement(name) {
  if (!name) {
    return;
  }
  rotateBucketsIfNeeded();
  bump(state.day.advancements, name);
  scheduleSave();
}

export function recordPlayerSnapshot(players = []) {
  rotateBucketsIfNeeded();
  const now = Date.now();
  const current = new Set(players.map(String));
  state.sessions = state.sessions || {};

      if (previousOnline == null) {
        for (const name of current) {
          state.sessions[name] = now;
          markJoined(name);
        }
        if (current.size > 0) {
          state.empty.since = null;
          state.empty.notifiedAt = null;
        }
        previousOnline = current;
        scheduleSave();
        return;
      }

  for (const name of current) {
    if (!previousOnline.has(name)) {
      state.sessions[name] = now;
      markJoined(name);
    }
  }
  for (const name of previousOnline) {
    if (current.has(name)) {
      continue;
    }
    const started = state.sessions[name];
    if (started) {
      const delta = Math.max(0, now - started);
      state.day.playMs[name] = (state.day.playMs[name] || 0) + delta;
      state.week.playMs[name] = (state.week.playMs[name] || 0) + delta;
      delete state.sessions[name];
    }
  }

  if (previousOnline.size > 0 && current.size === 0) {
    state.empty.since = now;
    state.empty.notifiedAt = null;
  }
  if (previousOnline.size === 0 && current.size > 0) {
    state.empty.since = null;
    state.empty.notifiedAt = null;
  }

  previousOnline = current;
  scheduleSave();
}

function sumCounts(map) {
  return Object.values(map || {}).reduce((total, value) => total + Number(value || 0), 0);
}

function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(Number(ms) / 60000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours <= 0) {
    return `${minutes} мин`;
  }
  if (minutes <= 0) {
    return `${hours} ч`;
  }
  return `${hours} ч ${minutes} мин`;
}

function playMsWithOpenSessions(playMs) {
  const now = Date.now();
  const result = { ...playMs };
  for (const [name, started] of Object.entries(state.sessions || {})) {
    result[name] = (result[name] || 0) + Math.max(0, now - started);
  }
  return result;
}

function topEntries(map, limit = TOP_LIMIT) {
  return Object.entries(map || {})
    .filter(([, value]) => Number(value) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

export function shouldPostOnlineDigest(parts = zonedParts()) {
  rotateBucketsIfNeeded();
  return state.lastDigestPosted !== digestHourKey(parts);
}

export function markOnlineDigestPosted(parts = zonedParts()) {
  state.lastDigestPosted = digestHourKey(parts);
  scheduleSave();
}

export function shouldPostMoonPhase(moon) {
  if (moon?.day == null || !moon.key) {
    return false;
  }
  return state.lastMoonPosted?.day !== moon.day || state.lastMoonPosted?.key !== moon.key;
}

export function markMoonPhasePosted(moon) {
  state.lastMoonPosted = { day: moon.day, key: moon.key };
  scheduleSave();
}

export function takeEmptyWorldAnnouncement(now = Date.now()) {
  rotateBucketsIfNeeded();
  const since = state.empty?.since;
  if (!since || state.empty.notifiedAt) {
    return null;
  }
  if (now - since < config.server.emptyWorldMs) {
    return null;
  }
  state.empty.notifiedAt = now;
  scheduleSave();
  const hours = Math.max(1, Math.floor((now - since) / 3600000));
  const sinceLabel = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timeZone(),
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(since));
  return { since, sinceLabel, hours };
}

export function takeDailyRecap(parts = zonedParts()) {
  rotateBucketsIfNeeded();
  const today = dateKey(parts);
  if (Number(parts.hour) !== Number(config.server.dailyRecapHour)) {
    return null;
  }
  if (state.lastDailyPosted === today) {
    return null;
  }

  const players = Object.keys(state.day.joined).sort((left, right) => left.localeCompare(right));
  const deaths = sumCounts(state.day.deaths);
  const advancements = sumCounts(state.day.advancements);
  state.lastDailyPosted = today;
  scheduleSave();

  if (!players.length && !deaths && !advancements) {
    return null;
  }

  const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    timeZone: timeZone(),
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return {
    dateLabel, players, deaths, advancements,
  };
}

export function takeWeeklyRecap(parts = zonedParts()) {
  rotateBucketsIfNeeded();
  if (weekdayNumber(parts) !== Number(config.server.weeklyRecapWeekday)) {
    return null;
  }
  if (Number(parts.hour) !== Number(config.server.dailyRecapHour)) {
    return null;
  }
  const week = isoWeekKey(parts);
  if (state.lastWeeklyPosted === week) {
    return null;
  }

  const playTop = topEntries(playMsWithOpenSessions(state.week.playMs)).map(([name, ms]) => ({
    name,
    duration: formatDuration(ms),
  }));
  const deathTop = topEntries(state.week.deaths).map(([name, count]) => ({ name, count }));
  state.lastWeeklyPosted = week;
  scheduleSave();

  if (!playTop.length && !deathTop.length) {
    return null;
  }
  return { playTop, deathTop };
}

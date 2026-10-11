import fs from 'node:fs/promises';
import path from 'node:path';

import config from '../../config/default.js';

const WEEKDAYS = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const TOP_LIMIT = 5;
const SAVE_DEBOUNCE_MS = 400;
const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;

let state = blankState();
let loaded = false;
let saveTimer = null;
let previousOnline = null;

function timeZone() {
  return config.server.timeZone || 'UTC';
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
    key, joined: {}, deaths: {}, advancements: {}, playMs: {}, loginBonus: {},
  };
}

function emptyWeek(key) {
  return {
    key, deaths: {}, playMs: {},
  };
}

function emptyWorldState() {
  return { since: null, notifiedHours: [], lastEmptyDayPosted: null };
}

function blankState() {
  const parts = zonedParts();
  return {
    knownPlayers: {},
    day: emptyDay(dateKey(parts)),
    week: emptyWeek(isoWeekKey(parts)),
    empty: emptyWorldState(),
    lastDailyPosted: null,
    lastWeeklyPosted: null,
    lastDigestPosted: null,
    lastDigestPostedAt: null,
    statusBoard: null,
    sessions: {},
    starterGranted: {},
    loginStreak: {},
  };
}

function normalizeUuid(uuid) {
  return String(uuid || '').toLowerCase().replace(/-/g, '');
}

function playerName(name) {
  return String(name || '').trim();
}

function ensurePlayMaps() {
  if (!state.day || typeof state.day !== 'object') {
    state.day = emptyDay(dateKey());
  }
  if (!state.day.playMs || typeof state.day.playMs !== 'object' || Array.isArray(state.day.playMs)) {
    state.day.playMs = {};
  }
  if (!state.week || typeof state.week !== 'object') {
    state.week = emptyWeek(isoWeekKey());
  }
  if (!state.week.playMs || typeof state.week.playMs !== 'object' || Array.isArray(state.week.playMs)) {
    state.week.playMs = {};
  }
  if (!state.sessions || typeof state.sessions !== 'object' || Array.isArray(state.sessions)) {
    state.sessions = {};
  }
  if (!state.day.loginBonus || typeof state.day.loginBonus !== 'object' || Array.isArray(state.day.loginBonus)) {
    state.day.loginBonus = {};
  }
  if (!state.starterGranted || typeof state.starterGranted !== 'object' || Array.isArray(state.starterGranted)) {
    state.starterGranted = {};
  }
  if (!state.loginStreak || typeof state.loginStreak !== 'object' || Array.isArray(state.loginStreak)) {
    state.loginStreak = {};
  }
}

function addPlayMs(name, delta) {
  const ms = Math.max(0, Number(delta) || 0);
  if (!name || !ms) {
    return;
  }
  ensurePlayMaps();
  state.day.playMs[name] = (Number(state.day.playMs[name]) || 0) + ms;
  state.week.playMs[name] = (Number(state.week.playMs[name]) || 0) + ms;
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
  ensurePlayMaps();
  for (const [name, started] of Object.entries(state.sessions)) {
    addPlayMs(name, now - Number(started));
    state.sessions[name] = now;
  }
}

function openSession(name, now = Date.now()) {
  const key = playerName(name);
  if (!key) {
    return;
  }
  ensurePlayMaps();
  if (state.sessions[key] == null) {
    state.sessions[key] = now;
  }
}

function closeSession(name, now = Date.now()) {
  const key = playerName(name);
  if (!key) {
    return;
  }
  ensurePlayMaps();
  const started = state.sessions[key];
  if (started == null) {
    return;
  }
  addPlayMs(key, now - Number(started));
  delete state.sessions[key];
}

function markJoined(name) {
  const key = playerName(name);
  if (!key) {
    return;
  }
  if (!state.day.joined || typeof state.day.joined !== 'object') {
    state.day.joined = {};
  }
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
    lastDigestPostedAt: state.lastDigestPostedAt,
    statusBoard: state.statusBoard,
    starterGranted: state.starterGranted,
    loginStreak: state.loginStreak,
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

function asStatusBoard(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const messageId = Number(raw.messageId);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return null;
  }
  const fileIds = raw.fileIds && typeof raw.fileIds === 'object' && !Array.isArray(raw.fileIds)
    ? raw.fileIds
    : {};
  return {
    messageId,
    chatId: Number(raw.chatId) || null,
    threadId: Number(raw.threadId) || null,
    fileIds,
    imagePath: raw.imagePath || null,
    hasPhoto: Boolean(raw.hasPhoto),
  };
}

function fileIdsEqual(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

function sameStatusBoard(left, right) {
  return left
    && right
    && left.messageId === right.messageId
    && left.chatId === right.chatId
    && left.threadId === right.threadId
    && left.hasPhoto === right.hasPhoto
    && left.imagePath === right.imagePath
    && fileIdsEqual(left.fileIds, right.fileIds);
}

export function getStatusBoard() {
  return state.statusBoard;
}

export function setStatusBoard(pointer) {
  const next = asStatusBoard(pointer);
  if (sameStatusBoard(state.statusBoard, next)) {
    return;
  }
  state.statusBoard = next;
  scheduleSave();
}

function asStreakMap(raw) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return result;
  }
  for (const [key, value] of Object.entries(raw)) {
    const name = playerName(key);
    if (!name || !value || typeof value !== 'object') {
      continue;
    }
    const count = Math.max(0, Number(value.count) || 0);
    const lastDate = String(value.lastDate || '');
    if (!count || !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) {
      continue;
    }
    result[name] = { count, lastDate };
  }
  return result;
}

function shiftDateKey(key, days) {
  const [year, month, day] = String(key).split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const utc = new Date(Date.UTC(year, month - 1, day + Number(days)));
  return [
    utc.getUTCFullYear(),
    String(utc.getUTCMonth() + 1).padStart(2, '0'),
    String(utc.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function previewLoginStreak(name) {
  const today = dateKey();
  const previous = state.loginStreak[name];
  if (previous?.lastDate === today) {
    return Number(previous.count) || 1;
  }
  if (previous?.lastDate === shiftDateKey(today, -1)) {
    return (Number(previous.count) || 0) + 1;
  }
  return 1;
}

function asFlagMap(raw) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return result;
  }
  for (const [key, value] of Object.entries(raw)) {
    const name = playerName(key);
    if (name && value) {
      result[name] = true;
    }
  }
  return result;
}

function asCountMap(raw) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return result;
  }
  for (const [key, value] of Object.entries(raw)) {
    const name = playerName(key);
    const amount = Number(value);
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    result[name] = amount;
  }
  return result;
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
    next.day = {
      ...emptyDay(raw.day.key),
      ...raw.day,
      joined: raw.day.joined && typeof raw.day.joined === 'object' ? raw.day.joined : {},
      deaths: asCountMap(raw.day.deaths),
      advancements: asCountMap(raw.day.advancements),
      playMs: asCountMap(raw.day.playMs),
      loginBonus: asFlagMap(raw.day.loginBonus),
    };
  }
  if (raw.week?.key) {
    next.week = {
      ...emptyWeek(raw.week.key),
      ...raw.week,
      deaths: asCountMap(raw.week.deaths),
      playMs: asCountMap(raw.week.playMs),
    };
  }
  if (raw.empty && typeof raw.empty === 'object') {
    const hours = Array.isArray(raw.empty.notifiedHours)
      ? raw.empty.notifiedHours.map(Number).filter((value) => Number.isFinite(value) && value > 0)
      : (raw.empty.notifiedAt ? [3] : []);
    next.empty = {
      since: raw.empty.since || null,
      notifiedHours: hours,
      lastEmptyDayPosted: raw.empty.lastEmptyDayPosted || null,
    };
  }
  next.lastDailyPosted = raw.lastDailyPosted || null;
  next.lastWeeklyPosted = raw.lastWeeklyPosted || null;
  next.lastDigestPosted = raw.lastDigestPosted || null;
  const postedAt = Number(raw.lastDigestPostedAt);
  next.lastDigestPostedAt = Number.isFinite(postedAt) && postedAt > 0 ? postedAt : null;
  next.statusBoard = asStatusBoard(raw.statusBoard);
  next.starterGranted = asFlagMap(raw.starterGranted);
  next.loginStreak = asStreakMap(raw.loginStreak);
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

export function tryClaimDailyLoginBonus(name) {
  const key = playerName(name);
  if (!key) {
    return null;
  }
  rotateBucketsIfNeeded();
  ensurePlayMaps();
  if (state.day.loginBonus[key]) {
    return null;
  }
  state.day.loginBonus[key] = true;
  return {
    streak: previewLoginStreak(key),
    weekday: weekdayNumber(),
  };
}

export function confirmDailyLoginBonus(name) {
  const key = playerName(name);
  if (key) {
    rotateBucketsIfNeeded();
    ensurePlayMaps();
    state.loginStreak[key] = {
      count: previewLoginStreak(key),
      lastDate: dateKey(),
    };
  }
  scheduleSave();
}

export function releaseDailyLoginBonus(name) {
  const key = playerName(name);
  if (!key) {
    return;
  }
  rotateBucketsIfNeeded();
  ensurePlayMaps();
  if (!state.day.loginBonus[key]) {
    return;
  }
  delete state.day.loginBonus[key];
}

export function tryClaimStarterKit(name) {
  const key = playerName(name);
  if (!key) {
    return false;
  }
  ensurePlayMaps();
  if (state.starterGranted[key]) {
    return false;
  }
  state.starterGranted[key] = true;
  return true;
}

export function confirmStarterKit() {
  scheduleSave();
}

export function releaseStarterKit(name) {
  const key = playerName(name);
  if (!key) {
    return;
  }
  ensurePlayMaps();
  if (!state.starterGranted[key]) {
    return;
  }
  delete state.starterGranted[key];
}

export function recordJoin(name) {
  const key = playerName(name);
  if (!key) {
    return;
  }
  rotateBucketsIfNeeded();
  markJoined(key);
  openSession(key);
  scheduleSave();
}

export function recordLeave(name) {
  const key = playerName(name);
  if (!key) {
    return;
  }
  rotateBucketsIfNeeded();
  closeSession(key);
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
  ensurePlayMaps();
  const now = Date.now();
  const current = new Set(players.map(playerName).filter(Boolean));
  const previous = previousOnline ?? new Set();

  for (const name of previous) {
    if (!current.has(name)) {
      closeSession(name, now);
    }
  }
  for (const name of current) {
    openSession(name, now);
    markJoined(name);
  }
  foldOpenSessions(now);

  if (previousOnline != null) {
    if (previous.size > 0 && current.size === 0) {
      state.empty = { ...emptyWorldState(), since: now };
    }
    if (previous.size === 0 && current.size > 0) {
      state.empty = emptyWorldState();
    }
  } else if (current.size > 0) {
    state.empty = emptyWorldState();
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
    const key = playerName(name);
    result[key] = (Number(result[key]) || 0) + Math.max(0, now - Number(started));
  }
  return result;
}

function topEntries(map, limit = TOP_LIMIT) {
  return Object.entries(map || {})
    .filter(([, value]) => Number(value) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

function emptySinceLabel(since) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timeZone(),
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(since));
}

function emptyHourMilestones() {
  const hours = config.server.emptyWorldHours;
  return (hours?.length ? hours : [3, 9, 18]).slice().sort((left, right) => left - right);
}

export function takeEmptyWorldAnnouncement(now = Date.now(), parts = zonedParts()) {
  rotateBucketsIfNeeded();
  const since = state.empty?.since;
  if (!since) {
    return null;
  }

  const elapsed = now - since;
  const notifiedHours = Array.isArray(state.empty.notifiedHours) ? state.empty.notifiedHours : [];
  const reached = emptyHourMilestones().filter((hours) => elapsed >= hours * HOUR_MS);
  const pending = reached.filter((hours) => !notifiedHours.includes(hours));
  if (pending.length) {
    const hours = pending[pending.length - 1];
    state.empty.notifiedHours = [...new Set([...notifiedHours, ...pending])];
    scheduleSave();
    return { since, sinceLabel: emptySinceLabel(since), hours };
  }

  if (elapsed < DAY_MS) {
    return null;
  }
  if (Number(parts.hour) !== Number(config.server.dailyRecapHour)) {
    return null;
  }
  const today = dateKey(parts);
  if (state.empty.lastEmptyDayPosted === today) {
    return null;
  }
  state.empty.lastEmptyDayPosted = today;
  scheduleSave();
  return {
    since,
    sinceLabel: emptySinceLabel(since),
    days: Math.max(1, Math.floor(elapsed / DAY_MS)),
  };
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

export function ownerWorldStats() {
  rotateBucketsIfNeeded();
  const now = Date.now();
  const joined = Object.keys(state.day.joined || {})
    .sort((left, right) => left.localeCompare(right));
  const playToday = playMsWithOpenSessions(state.day.playMs);
  const sessions = Object.fromEntries(
    Object.keys(state.sessions || {}).map((name) => [
      name,
      formatDuration(playToday[name] || Math.max(0, now - Number(state.sessions[name] || now))),
    ]),
  );
  const emptySince = state.empty?.since;
  let empty = null;
  if (emptySince) {
    const elapsed = Math.max(0, now - emptySince);
    empty = {
      sinceLabel: emptySinceLabel(emptySince),
      minutes: Math.floor(elapsed / 60000),
      hours: Math.floor(elapsed / HOUR_MS),
      days: elapsed >= DAY_MS ? Math.max(1, Math.floor(elapsed / DAY_MS)) : 0,
    };
  }

  return {
    knownPlayers: Object.keys(state.knownPlayers || {}).length,
    joined,
    deaths: sumCounts(state.day.deaths),
    advancements: sumCounts(state.day.advancements),
    playTop: topEntries(playMsWithOpenSessions(state.day.playMs)).map(([name, ms]) => ({
      name,
      duration: formatDuration(ms),
    })),
    weekPlayTop: topEntries(playMsWithOpenSessions(state.week.playMs)).map(([name, ms]) => ({
      name,
      duration: formatDuration(ms),
    })),
    sessions,
    empty,
  };
}

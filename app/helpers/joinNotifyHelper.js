import { postToChannel } from './channelHelper.js';
import { joinLeaveText } from './copyHelper.js';

const recentEvents = new Map();
const DEDUPE_MS = 20000;

function pruneOldEvents() {
  const now = Date.now();
  for (const [key, seenAt] of recentEvents) {
    if (now - seenAt > DEDUPE_MS) {
      recentEvents.delete(key);
    }
  }
}

function isUnseenEvent(type, name) {
  pruneOldEvents();
  const key = `${type}:${String(name).toLowerCase()}`;
  if (recentEvents.has(key)) {
    return false;
  }
  recentEvents.set(key, Date.now());
  return true;
}

function toEvents({ events, joined = [], left = [] } = {}) {
  if (events?.length) {
    return events;
  }
  return [
    ...left.map((name) => ({ type: 'leave', name })),
    ...joined.map((name) => ({ type: 'join', name })),
  ];
}

export async function notifyJoinLeave(telegram, payload = {}) {
  const ordered = toEvents(payload);
  if (!ordered.length) {
    return;
  }

  const unique = ordered.filter((event) => isUnseenEvent(event.type, event.name));
  if (!unique.length) {
    console.info('[notify] skip join/leave: duplicate within 20s');
    return;
  }

  const text = joinLeaveText(unique, payload.current ?? null);
  const summary = unique.map((event) => `${event.type}:${event.name}`).join(', ');
  console.info(`[notify] send [${summary}]`);
  await postToChannel(telegram, text);
}

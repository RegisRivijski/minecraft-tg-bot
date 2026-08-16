import { listJoinRelay } from './chatRelayHelper.js';
import { HTML, joinLeaveText } from './copyHelper.js';

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

export async function notifyJoinLeave(telegram, { joined = [], left = [], current = null } = {}) {
  if (!joined.length && !left.length) {
    return;
  }

  const chatIds = listJoinRelay();
  if (!chatIds.length) {
    console.info('[notify] skip join/leave: no chats with /joins on');
    return;
  }

  const uniqueJoined = joined.filter((name) => isUnseenEvent('join', name));
  const uniqueLeft = left.filter((name) => isUnseenEvent('leave', name));
  if (!uniqueJoined.length && !uniqueLeft.length) {
    console.info('[notify] skip join/leave: duplicate within 20s');
    return;
  }

  const text = joinLeaveText(uniqueJoined, uniqueLeft, current);
  console.info(`[notify] send join=[${uniqueJoined.join(', ') || '—'}] leave=[${uniqueLeft.join(', ') || '—'}] to ${chatIds.join(', ')}`);
  await Promise.all(chatIds.map((chatId) => (
    telegram.sendMessage(chatId, text, HTML).catch((err) => {
      console.warn(`[notify] chat ${chatId}:`, err.message);
    })
  )));
}

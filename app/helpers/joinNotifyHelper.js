import { listJoinRelay } from './chatRelayHelper.js';
import { HTML, joinLeaveText } from './copyHelper.js';

const recent = new Map();
const DEDUPE_MS = 20000;

function take(type, name) {
  const key = `${type}:${String(name).toLowerCase()}`;
  const now = Date.now();
  for (const [item, at] of recent) {
    if (now - at > DEDUPE_MS) {
      recent.delete(item);
    }
  }
  if (recent.has(key)) {
    return false;
  }
  recent.set(key, now);
  return true;
}

export async function notifyJoinLeave(telegram, { joined = [], left = [], current = null } = {}) {
  if (!joined.length && !left.length) {
    return;
  }

  const chats = listJoinRelay();
  if (!chats.length) {
    console.info('[notify] skip join/leave: no chats with /joins on');
    return;
  }

  const uniqueJoined = joined.filter((name) => take('join', name));
  const uniqueLeft = left.filter((name) => take('leave', name));
  if (!uniqueJoined.length && !uniqueLeft.length) {
    console.info('[notify] skip join/leave: duplicate within 20s');
    return;
  }

  const text = joinLeaveText(uniqueJoined, uniqueLeft, current);
  console.info(`[notify] send join=[${uniqueJoined.join(', ') || '—'}] leave=[${uniqueLeft.join(', ') || '—'}] to ${chats.join(', ')}`);
  await Promise.all(chats.map((chatId) => (
    telegram.sendMessage(chatId, text, HTML).catch((err) => {
      console.warn(`[notify] chat ${chatId}:`, err.message);
    })
  )));
}

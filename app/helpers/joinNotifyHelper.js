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
  const chats = listJoinRelay();
  if (!chats.length) {
    return;
  }

  const uniqueJoined = joined.filter((name) => take('join', name));
  const uniqueLeft = left.filter((name) => take('leave', name));
  if (!uniqueJoined.length && !uniqueLeft.length) {
    return;
  }

  const text = joinLeaveText(uniqueJoined, uniqueLeft, current);
  await Promise.all(chats.map((chatId) => (
    telegram.sendMessage(chatId, text, HTML).catch((err) => {
      console.warn(`[notify] chat ${chatId}:`, err.message);
    })
  )));
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/chat-relay.json',
);

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(parsed)) {
      return new Set(parsed.map(Number).filter(Number.isFinite));
    }
  } catch {
    // first run
  }
  return new Set();
}

function save(ids) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify([...ids])}\n`);
}

const enabled = load();

export function isChatRelayEnabled(chatId) {
  return enabled.has(Number(chatId));
}

export function listChatRelay() {
  return [...enabled];
}

export function setChatRelay(chatId, on) {
  const id = Number(chatId);
  if (on) {
    enabled.add(id);
  } else {
    enabled.delete(id);
  }
  save(enabled);
  return on;
}

import Chat from '../models/minecraftTgBot/chats.js';

let chatRelay = new Set();
let joinRelay = new Set();

export async function loadChatRelay() {
  const docs = await Chat.find(
    { $or: [{ chatRelay: true }, { joinRelay: true }] },
    { chatId: 1, chatRelay: 1, joinRelay: 1 },
  ).lean();

  chatRelay = new Set();
  joinRelay = new Set();

  for (const doc of docs) {
    const id = Number(doc.chatId);
    if (!Number.isFinite(id)) {
      continue;
    }
    if (doc.chatRelay) {
      chatRelay.add(id);
    }
    if (doc.joinRelay) {
      joinRelay.add(id);
    }
  }
}

export function isChatRelayEnabled(chatId) {
  return chatRelay.has(Number(chatId));
}

export function isJoinRelayEnabled(chatId) {
  return joinRelay.has(Number(chatId));
}

export function listChatRelay() {
  return [...chatRelay];
}

export function listJoinRelay() {
  return [...joinRelay];
}

async function setRelay(cache, field, chatId, on, title = '') {
  const id = Number(chatId);
  const $set = {
    [field]: on,
    updated: new Date(),
  };
  if (title) {
    $set.title = title;
  }

  await Chat.findOneAndUpdate(
    { chatId: id },
    {
      $set,
      $setOnInsert: {
        chatId: id,
        created: new Date(),
      },
    },
    { upsert: true },
  );

  if (on) {
    cache.add(id);
  } else {
    cache.delete(id);
  }
  return on;
}

export function setChatRelay(chatId, on, title = '') {
  return setRelay(chatRelay, 'chatRelay', chatId, on, title);
}

export function setJoinRelay(chatId, on, title = '') {
  return setRelay(joinRelay, 'joinRelay', chatId, on, title);
}

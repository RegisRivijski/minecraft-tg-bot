import Chat from '../models/minecraftTgBot/chats.js';

let chatRelay = new Set();
let joinRelay = new Set();
let eventRelay = new Set();

export async function loadChatRelay() {
  const docs = await Chat.find(
    { $or: [{ chatRelay: true }, { joinRelay: true }, { eventRelay: true }] },
    { chatId: 1, chatRelay: 1, joinRelay: 1, eventRelay: 1 },
  ).lean();

  chatRelay = new Set();
  joinRelay = new Set();
  eventRelay = new Set();

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
    if (doc.eventRelay) {
      eventRelay.add(id);
    }
  }
  console.info(`[relay] loaded chat=[${[...chatRelay].join(', ') || '—'}] joins=[${[...joinRelay].join(', ') || '—'}] events=[${[...eventRelay].join(', ') || '—'}]`);
}

export function isChatRelayEnabled(chatId) {
  return chatRelay.has(Number(chatId));
}

export function isJoinRelayEnabled(chatId) {
  return joinRelay.has(Number(chatId));
}

export function isEventRelayEnabled(chatId) {
  return eventRelay.has(Number(chatId));
}

export function listChatRelay() {
  return [...chatRelay];
}

export function listJoinRelay() {
  return [...joinRelay];
}

export function listEventRelay() {
  return [...eventRelay];
}

async function persistRelay(chatId, fields, title = '') {
  const id = Number(chatId);
  const $set = {
    ...fields,
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
}

function applyCache(cache, chatId, on) {
  const id = Number(chatId);
  if (on) {
    cache.add(id);
  } else {
    cache.delete(id);
  }
  return id;
}

export async function setChatRelay(chatId, on, title = '') {
  const id = applyCache(chatRelay, chatId, on);
  await persistRelay(id, { chatRelay: on }, title);
  console.info(`[relay] chat ${id} ${on ? 'on' : 'off'}`);
  return on;
}

export async function setJoinRelay(chatId, on, title = '') {
  const id = applyCache(joinRelay, chatId, on);
  await persistRelay(id, { joinRelay: on }, title);
  console.info(`[relay] joins ${id} ${on ? 'on' : 'off'}`);
  return on;
}

export async function setEventRelay(chatId, on, title = '') {
  const id = applyCache(eventRelay, chatId, on);
  await persistRelay(id, { eventRelay: on }, title);
  console.info(`[relay] events ${id} ${on ? 'on' : 'off'}`);
  return on;
}

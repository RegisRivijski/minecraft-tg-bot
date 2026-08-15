import Chat from '../models/minecraftTgBot/chats.js';

let chatRelay = new Set();
let joinRelay = new Set();
let deathRelay = new Set();
let advancementRelay = new Set();

function inheritedRelay(value, fallback) {
  if (value === true || value === false) {
    return value;
  }
  return Boolean(fallback);
}

export async function loadChatRelay() {
  const docs = await Chat.find(
    {
      $or: [
        { chatRelay: true },
        { joinRelay: true },
        { eventRelay: true },
        { deathRelay: true },
        { advancementRelay: true },
      ],
    },
    {
      chatId: 1,
      chatRelay: 1,
      joinRelay: 1,
      eventRelay: 1,
      deathRelay: 1,
      advancementRelay: 1,
    },
  ).lean();

  chatRelay = new Set();
  joinRelay = new Set();
  deathRelay = new Set();
  advancementRelay = new Set();

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
    if (inheritedRelay(doc.deathRelay, doc.eventRelay)) {
      deathRelay.add(id);
    }
    if (inheritedRelay(doc.advancementRelay, doc.eventRelay)) {
      advancementRelay.add(id);
    }
  }
  console.info(`[relay] loaded chat=[${[...chatRelay].join(', ') || '—'}] joins=[${[...joinRelay].join(', ') || '—'}] deaths=[${[...deathRelay].join(', ') || '—'}] advancements=[${[...advancementRelay].join(', ') || '—'}]`);
}

export function isChatRelayEnabled(chatId) {
  return chatRelay.has(Number(chatId));
}

export function isJoinRelayEnabled(chatId) {
  return joinRelay.has(Number(chatId));
}

export function isDeathRelayEnabled(chatId) {
  return deathRelay.has(Number(chatId));
}

export function isAdvancementRelayEnabled(chatId) {
  return advancementRelay.has(Number(chatId));
}

export function listChatRelay() {
  return [...chatRelay];
}

export function listJoinRelay() {
  return [...joinRelay];
}

export function listDeathRelay() {
  return [...deathRelay];
}

export function listAdvancementRelay() {
  return [...advancementRelay];
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

export async function setDeathRelay(chatId, on, title = '') {
  const id = applyCache(deathRelay, chatId, on);
  await persistRelay(id, { deathRelay: on }, title);
  console.info(`[relay] deaths ${id} ${on ? 'on' : 'off'}`);
  return on;
}

export async function setAdvancementRelay(chatId, on, title = '') {
  const id = applyCache(advancementRelay, chatId, on);
  await persistRelay(id, { advancementRelay: on }, title);
  console.info(`[relay] advancements ${id} ${on ? 'on' : 'off'}`);
  return on;
}

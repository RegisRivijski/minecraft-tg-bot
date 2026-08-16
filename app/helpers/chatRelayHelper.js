import Chat from '../models/minecraftTgBot/chats.js';
import { canReceiveRelay } from './accessHelper.js';

let chatRelay = new Set();
let joinRelay = new Set();
let deathRelay = new Set();
let advancementRelay = new Set();

// Older documents used a single eventRelay flag for both deaths and advancements.
function relayOrLegacyEventFlag(value, legacyEventRelay) {
  if (value === true || value === false) {
    return value;
  }
  return Boolean(legacyEventRelay);
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
    const chatId = Number(doc.chatId);
    if (!Number.isFinite(chatId)) {
      continue;
    }
    if (doc.chatRelay) {
      chatRelay.add(chatId);
    }
    if (doc.joinRelay) {
      joinRelay.add(chatId);
    }
    if (relayOrLegacyEventFlag(doc.deathRelay, doc.eventRelay)) {
      deathRelay.add(chatId);
    }
    if (relayOrLegacyEventFlag(doc.advancementRelay, doc.eventRelay)) {
      advancementRelay.add(chatId);
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
  return [...chatRelay].filter(canReceiveRelay);
}

export function listJoinRelay() {
  return [...joinRelay].filter(canReceiveRelay);
}

export function listDeathRelay() {
  return [...deathRelay].filter(canReceiveRelay);
}

export function listAdvancementRelay() {
  return [...advancementRelay].filter(canReceiveRelay);
}

async function saveRelayToDb(chatId, fields, title = '') {
  const $set = {
    ...fields,
    updated: new Date(),
  };
  if (title) {
    $set.title = title;
  }

  await Chat.findOneAndUpdate(
    { chatId },
    {
      $set,
      $setOnInsert: {
        chatId,
        created: new Date(),
      },
    },
    { upsert: true },
  );
}

function updateRelayCache(cache, chatId, enabled) {
  const id = Number(chatId);
  if (enabled) {
    cache.add(id);
  } else {
    cache.delete(id);
  }
  return id;
}

export async function setChatRelay(chatId, enabled, title = '') {
  const id = updateRelayCache(chatRelay, chatId, enabled);
  await saveRelayToDb(id, { chatRelay: enabled }, title);
  console.info(`[relay] chat ${id} ${enabled ? 'on' : 'off'}`);
  return enabled;
}

export async function setJoinRelay(chatId, enabled, title = '') {
  const id = updateRelayCache(joinRelay, chatId, enabled);
  await saveRelayToDb(id, { joinRelay: enabled }, title);
  console.info(`[relay] joins ${id} ${enabled ? 'on' : 'off'}`);
  return enabled;
}

export async function setDeathRelay(chatId, enabled, title = '') {
  const id = updateRelayCache(deathRelay, chatId, enabled);
  await saveRelayToDb(id, { deathRelay: enabled }, title);
  console.info(`[relay] deaths ${id} ${enabled ? 'on' : 'off'}`);
  return enabled;
}

export async function setAdvancementRelay(chatId, enabled, title = '') {
  const id = updateRelayCache(advancementRelay, chatId, enabled);
  await saveRelayToDb(id, { advancementRelay: enabled }, title);
  console.info(`[relay] advancements ${id} ${enabled ? 'on' : 'off'}`);
  return enabled;
}

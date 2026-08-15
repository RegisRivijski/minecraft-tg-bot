import Chat from '../models/chats.js';

let enabled = new Set();

export async function loadChatRelay() {
  const docs = await Chat.find({ chatRelay: true }, { chatId: 1 }).lean();
  enabled = new Set(docs.map((doc) => Number(doc.chatId)).filter(Number.isFinite));
}

export function isChatRelayEnabled(chatId) {
  return enabled.has(Number(chatId));
}

export function listChatRelay() {
  return [...enabled];
}

export async function setChatRelay(chatId, on, title = '') {
  const id = Number(chatId);
  const $set = {
    chatRelay: on,
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
    enabled.add(id);
  } else {
    enabled.delete(id);
  }
  return on;
}

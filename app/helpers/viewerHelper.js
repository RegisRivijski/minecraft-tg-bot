import { OWNER_IDS } from '../constants/access.js';
import Chat from '../models/minecraftTgBot/chats.js';
import {
  accessRequestKeyboard,
  accessRequestOwnerText,
  htmlMarkup,
} from './copyHelper.js';
import {
  accessSnapshot,
  hydrateAccess,
  isApproved,
  isOwner,
  isPending,
  isRevoked,
  markApproved,
  markPending,
  markRevoked,
} from './accessHelper.js';

// Former VIEWER_IDS / CHAT_IDS — one-time bootstrap so existing access survives the move to Mongo.
const LEGACY_APPROVED = [
  { chatId: 5695468319, kind: 'private' },
  { chatId: -1001730603392, kind: 'group' },
];

export function chatKind(chat) {
  return chat?.type === 'private' ? 'private' : 'group';
}

export function profileFrom(chat, from = {}) {
  if (chatKind(chat) === 'private') {
    const person = from.id ? from : chat;
    return {
      kind: 'private',
      title: [person.first_name, person.last_name].filter(Boolean).join(' '),
      username: person.username || '',
      firstName: person.first_name || '',
      lastName: person.last_name || '',
    };
  }
  return {
    kind: 'group',
    title: chat.title || '',
    username: chat.username || '',
    firstName: '',
    lastName: '',
  };
}

export function accessLabel(doc) {
  if (!doc) {
    return 'неизвестно';
  }
  if (doc.kind === 'group') {
    return doc.title || `чат ${doc.chatId}`;
  }
  const name = [doc.firstName, doc.lastName].filter(Boolean).join(' ') || doc.title || '';
  if (doc.username) {
    return name ? `${name} (@${doc.username})` : `@${doc.username}`;
  }
  return name || `id ${doc.chatId}`;
}

function compact(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

async function saveAccess(chatId, fields) {
  const id = Number(chatId);
  await Chat.findOneAndUpdate(
    { chatId: id },
    {
      $set: {
        ...compact(fields),
        chatId: id,
        updated: new Date(),
      },
      $setOnInsert: {
        created: new Date(),
      },
    },
    { upsert: true },
  );
  return id;
}

export async function findAccess(chatId) {
  return Chat.findOne({ chatId: Number(chatId) }).lean();
}

export async function listViewers() {
  const docs = await Chat.find({
    status: { $in: ['pending', 'approved', 'revoked'] },
  }).sort({ created: 1 }).lean();
  return docs.filter((doc) => !isOwner(doc.chatId));
}

export async function approveAccess(chatId, decidedBy, profile = {}) {
  const id = await saveAccess(chatId, {
    ...profile,
    status: 'approved',
    decidedBy,
    decidedAt: new Date(),
  });
  markApproved(id);
  console.info(`[acl] approved ${id}`);
  return id;
}

export async function revokeAccess(chatId, decidedBy, profile = {}) {
  const id = await saveAccess(chatId, {
    ...profile,
    status: 'revoked',
    decidedBy,
    decidedAt: new Date(),
  });
  markRevoked(id);
  console.info(`[acl] revoked ${id}`);
  return id;
}

export async function requestAccess(ctx) {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat) {
    return { status: 'ignored' };
  }

  const chatId = Number(chat.id);
  if (isOwner(from?.id) || isApproved(chatId)) {
    return { status: 'approved' };
  }
  if (isPending(chatId)) {
    return { status: 'pending' };
  }

  const profile = profileFrom(chat, from);
  await saveAccess(chatId, {
    ...profile,
    status: 'pending',
    requestedBy: from?.id,
    requestedAt: new Date(),
  });
  markPending(chatId);
  console.info(`[acl] request ${profile.kind} ${chatId}`);
  return { status: 'requested', chatId, profile, from, chat };
}

export async function submitAccessRequest(ctx) {
  const result = await requestAccess(ctx);
  if (result.status === 'requested') {
    await notifyOwners(
      ctx.telegram,
      accessRequestOwnerText({
        kind: result.profile.kind,
        label: accessLabel({ ...result.profile, chatId: result.chatId }),
        chatId: result.chatId,
        from: result.from,
      }),
      htmlMarkup(accessRequestKeyboard(result.chatId)),
    );
  }
  return result;
}

export async function notifyOwners(telegram, text, extra) {
  await Promise.all(OWNER_IDS.map((ownerId) => (
    telegram.sendMessage(ownerId, text, extra).catch((err) => {
      console.warn(`[acl] owner ${ownerId}:`, err.message);
    })
  )));
}

export async function notifyTarget(telegram, chatId, text, extra) {
  await telegram.sendMessage(chatId, text, extra).catch((err) => {
    console.warn(`[acl] target ${chatId}:`, err.message);
  });
}

export async function ensureOwnerChatAccess(ctx) {
  const chat = ctx.chat;
  if (!chat || chat.type === 'private' || isApproved(chat.id) || isRevoked(chat.id)) {
    return false;
  }
  await approveAccess(chat.id, ctx.from?.id, profileFrom(chat, ctx.from));
  return true;
}

async function seedLegacyAccess() {
  for (const item of LEGACY_APPROVED) {
    if (
      isOwner(item.chatId)
      || isApproved(item.chatId)
      || isPending(item.chatId)
      || isRevoked(item.chatId)
    ) {
      continue;
    }
    await approveAccess(item.chatId, null, { kind: item.kind });
    console.info(`[acl] seeded ${item.kind} ${item.chatId}`);
  }
}

export async function loadAccess() {
  const docs = await Chat.find(
    { status: { $in: ['pending', 'approved', 'revoked'] } },
    { chatId: 1, status: 1 },
  ).lean();

  const approved = [];
  const pending = [];
  const revoked = [];
  for (const doc of docs) {
    const id = Number(doc.chatId);
    if (!Number.isFinite(id)) {
      continue;
    }
    if (doc.status === 'approved') {
      approved.push(id);
    } else if (doc.status === 'pending') {
      pending.push(id);
    } else if (doc.status === 'revoked') {
      revoked.push(id);
    }
  }
  hydrateAccess({ approved, pending, revoked });
  await seedLegacyAccess();

  const snapshot = accessSnapshot();
  console.info(`[acl] approved=[${snapshot.approved.join(', ') || '—'}] pending=[${snapshot.pending.join(', ') || '—'}]`);
}

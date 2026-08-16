import { OWNER_IDS } from '../constants/access.js';
import { HTML, noPermission } from './copyHelper.js';

const approvedIds = new Set();
const pendingIds = new Set();
const revokedIds = new Set();

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}

export function isOwnerCtx(ctx) {
  return isOwner(ctx.from?.id);
}

export function isApproved(id) {
  return approvedIds.has(Number(id));
}

export function isPending(id) {
  return pendingIds.has(Number(id));
}

export function isRevoked(id) {
  return revokedIds.has(Number(id));
}

export function canReceiveRelay(chatId) {
  const id = Number(chatId);
  return isOwner(id) || isApproved(id);
}

export function canUseBot(ctx) {
  if (isOwner(ctx.from?.id)) {
    return true;
  }
  const chatId = ctx.chat?.id;
  if (chatId == null) {
    return false;
  }
  return isApproved(chatId);
}

export function hydrateAccess({ approved = [], pending = [], revoked = [] }) {
  approvedIds.clear();
  pendingIds.clear();
  revokedIds.clear();
  for (const id of approved) {
    approvedIds.add(Number(id));
  }
  for (const id of pending) {
    pendingIds.add(Number(id));
  }
  for (const id of revoked) {
    revokedIds.add(Number(id));
  }
}

export function markApproved(id) {
  const chatId = Number(id);
  approvedIds.add(chatId);
  pendingIds.delete(chatId);
  revokedIds.delete(chatId);
}

export function markPending(id) {
  const chatId = Number(id);
  pendingIds.add(chatId);
  approvedIds.delete(chatId);
  revokedIds.delete(chatId);
}

export function markRevoked(id) {
  const chatId = Number(id);
  revokedIds.add(chatId);
  approvedIds.delete(chatId);
  pendingIds.delete(chatId);
}

export function accessSnapshot() {
  return {
    approved: [...approvedIds],
    pending: [...pendingIds],
    revoked: [...revokedIds],
  };
}

export async function requireOwner(ctx) {
  if (isOwnerCtx(ctx)) {
    return true;
  }
  await ctx.reply(noPermission(), HTML);
  return false;
}

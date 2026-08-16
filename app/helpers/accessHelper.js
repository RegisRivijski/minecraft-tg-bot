import { CHAT_IDS, OWNER_IDS, VIEWER_IDS } from '../constants/access.js';
import { HTML, noPermission } from './copyHelper.js';

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}

export function isViewer(userId) {
  return VIEWER_IDS.includes(Number(userId));
}

export function isAllowedChat(chatId) {
  return CHAT_IDS.includes(Number(chatId));
}

export function canUseBot(ctx) {
  if (isAllowedChat(ctx.chat?.id)) {
    return true;
  }
  // Groups outside CHAT_IDS are ignored. Private chats: owners and viewers only.
  if (ctx.chat?.type !== 'private') {
    return false;
  }
  const userId = ctx.from?.id;
  return isOwner(userId) || isViewer(userId);
}

export function isOwnerCtx(ctx) {
  return isOwner(ctx.from?.id);
}

export async function requireOwner(ctx) {
  if (isOwnerCtx(ctx)) {
    return true;
  }
  await ctx.reply(noPermission(), HTML);
  return false;
}

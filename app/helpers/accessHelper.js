import { CHAT_IDS, OWNER_IDS } from '../constants/access.js';
import { HTML, noPermission } from './copyHelper.js';

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}

export function isAllowedChat(chatId) {
  return CHAT_IDS.includes(Number(chatId));
}

export function canUseBot(ctx) {
  if (isAllowedChat(ctx.chat?.id)) {
    return true;
  }
  return ctx.chat?.type === 'private' && isOwner(ctx.from?.id);
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

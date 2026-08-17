import { OWNER_IDS } from '../constants/access.js';
import { HTML, noPermission } from './copyHelper.js';

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}

export function isOwnerCtx(ctx) {
  return isOwner(ctx.from?.id);
}

export function canUseBot(ctx) {
  return ctx.chat?.type === 'private' && isOwnerCtx(ctx);
}

export async function requireOwner(ctx) {
  if (isOwnerCtx(ctx)) {
    return true;
  }
  await ctx.reply(noPermission(), HTML);
  return false;
}

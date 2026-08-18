import { OWNER_IDS } from '../constants/access.js';
import { HTML, noPermission } from './copyHelper.js';
import { isForumGroup, isGeneralTopic } from './forumHelper.js';

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}

export function isOwnerCtx(ctx) {
  return isOwner(ctx.from?.id);
}

export function canUseBot(ctx) {
  return ctx.chat?.type === 'private' && isOwnerCtx(ctx);
}

export function isWhitelistCommand(ctx) {
  return /^\/whitelist(?:@\S+)?(?:\s|$)/i.test(ctx.message?.text || '');
}

export function canManageWhitelist(ctx) {
  if (ctx.from?.is_bot || !ctx.from?.id) {
    return false;
  }
  if (canUseBot(ctx)) {
    return true;
  }
  return isForumGroup(ctx.chat?.id) && isGeneralTopic(ctx.message);
}

export async function requireOwner(ctx) {
  if (isOwnerCtx(ctx)) {
    return true;
  }
  await ctx.reply(noPermission(), HTML);
  return false;
}

export async function requireWhitelistAccess(ctx) {
  if (canManageWhitelist(ctx)) {
    return true;
  }
  await ctx.reply(noPermission(), HTML);
  return false;
}

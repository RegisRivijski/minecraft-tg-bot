import { isOwnerCtx } from '../constants/access.js';
import { HTML, noPermission } from './copyHelper.js';

export async function requireOwner(ctx) {
  if (isOwnerCtx(ctx)) {
    return true;
  }
  await ctx.reply(noPermission(), HTML);
  return false;
}

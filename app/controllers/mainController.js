import { isOwnerCtx } from '../constants/access.js';
import { HTML, helpText, loadingWorld } from '../helpers/copyHelper.js';

export async function start(ctx) {
  await ctx.reply(loadingWorld(), HTML);
}

export async function help(ctx) {
  await ctx.reply(helpText(isOwnerCtx(ctx)), HTML);
}

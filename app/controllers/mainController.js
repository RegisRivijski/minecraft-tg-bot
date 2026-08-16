import { isOwnerCtx } from '../helpers/accessHelper.js';
import { HTML, helpText, startText } from '../helpers/copyHelper.js';

export async function start(ctx) {
  await ctx.reply(startText(), HTML);
}

export async function help(ctx) {
  await ctx.reply(helpText(isOwnerCtx(ctx)), HTML);
}

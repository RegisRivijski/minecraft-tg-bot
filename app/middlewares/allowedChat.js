import { canUseBot, isOwnerCtx } from '../helpers/accessHelper.js';
import { accessGateText, HTML } from '../helpers/copyHelper.js';
import { ensureOwnerChatAccess, submitAccessRequest } from '../helpers/viewerHelper.js';

function isCommand(ctx) {
  const text = ctx.message?.text || '';
  return text.startsWith('/');
}

export default async function allowedChat(ctx, next) {
  if (ctx.myChatMember) {
    return next();
  }

  if (isOwnerCtx(ctx)) {
    await ensureOwnerChatAccess(ctx);
    return next();
  }

  if (ctx.callbackQuery) {
    if (canUseBot(ctx)) {
      return next();
    }
    await ctx.answerCbQuery('Нет доступа').catch(() => {});
    return;
  }

  if (canUseBot(ctx)) {
    return next();
  }

  if (!isCommand(ctx)) {
    return;
  }

  const result = await submitAccessRequest(ctx);
  await ctx.reply(accessGateText(result.status), HTML);
}

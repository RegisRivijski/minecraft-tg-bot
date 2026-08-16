import { canUseBot } from '../helpers/accessHelper.js';
import { deniedText, HTML } from '../helpers/copyHelper.js';

export default async function allowedChat(ctx, next) {
  if (canUseBot(ctx)) {
    return next();
  }

  const isPrivate = ctx.chat?.type === 'private';
  const text = ctx.message?.text || '';

  // In groups stay silent unless someone sent a command, so the bot
  // does not reply to every random message from an unknown chat.
  if (isPrivate || text.startsWith('/')) {
    await ctx.reply(deniedText({
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      isPrivate,
    }), HTML);
  }
}

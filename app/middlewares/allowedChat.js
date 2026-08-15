import { canUseBot } from '../constants/access.js';
import { deniedText, HTML } from '../helpers/copy.js';

export default async function allowedChat(ctx, next) {
  if (canUseBot(ctx)) {
    return next();
  }

  const isPrivate = ctx.chat?.type === 'private';
  const text = ctx.message?.text || '';

  if (isPrivate || text.startsWith('/')) {
    await ctx.reply(deniedText({
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      isPrivate,
    }), HTML);
  }
}

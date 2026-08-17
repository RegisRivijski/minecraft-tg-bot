import { canUseBot } from '../helpers/accessHelper.js';
import { isRelayChat, logForeignGroup } from '../helpers/chatBridgeHelper.js';

function isCommand(ctx) {
  const text = ctx.message?.text || ctx.channelPost?.text || '';
  return text.startsWith('/');
}

function isGroupMessage(ctx) {
  const type = ctx.chat?.type;
  if (!['group', 'supergroup'].includes(type)) {
    return false;
  }
  return Boolean(ctx.message);
}

export default async function allowedChat(ctx, next) {
  if (ctx.myChatMember) {
    return next();
  }
  if (canUseBot(ctx)) {
    return next();
  }
  if (isGroupMessage(ctx) && !isCommand(ctx)) {
    if (isRelayChat(ctx.chat.id)) {
      return next();
    }
    logForeignGroup(ctx);
  }
}

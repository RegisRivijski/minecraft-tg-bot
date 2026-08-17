import { canUseBot } from '../helpers/accessHelper.js';
import { isRelayChat } from '../helpers/chatBridgeHelper.js';

function isCommand(ctx) {
  const text = ctx.message?.text || '';
  return text.startsWith('/');
}

export default async function allowedChat(ctx, next) {
  if (ctx.myChatMember) {
    return next();
  }
  if (canUseBot(ctx)) {
    return next();
  }
  if (isRelayChat(ctx.chat?.id) && ctx.message && !isCommand(ctx)) {
    return next();
  }
}

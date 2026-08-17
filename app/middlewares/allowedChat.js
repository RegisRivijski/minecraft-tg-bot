import { canUseBot } from '../helpers/accessHelper.js';

export default async function allowedChat(ctx, next) {
  if (ctx.myChatMember) {
    return next();
  }
  if (!canUseBot(ctx)) {
    return;
  }
  return next();
}

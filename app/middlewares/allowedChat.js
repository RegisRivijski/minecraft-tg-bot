import { canUseBot, isWhitelistCommand } from '../helpers/accessHelper.js';
import { isRelayMessage, logForeignGroup } from '../helpers/chatBridgeHelper.js';
import { isForumGroup, isGeneralTopic } from '../helpers/forumHelper.js';

function isCommand(ctx) {
  const text = ctx.message?.text || '';
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
  if (!isGroupMessage(ctx)) {
    return;
  }
  if (isForumGroup(ctx.chat.id)) {
    if (isGeneralTopic(ctx.message)) {
      if (isCommand(ctx) && isWhitelistCommand(ctx)) {
        return next();
      }
      return;
    }
    if (!isCommand(ctx) && isRelayMessage(ctx)) {
      return next();
    }
    return;
  }
  if (!isCommand(ctx)) {
    logForeignGroup(ctx);
  }
}

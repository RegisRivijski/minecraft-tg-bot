import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { getGroupChatId, getThreadId, isChatTopicMessage, isForumGroup } from './forumHelper.js';
import { speakerName, stripMcColor } from './minecraftHelper.js';

const MAX_TEXT = 200;

let skipLog = new Set();

export function isRelayMessage(ctx) {
  return isForumGroup(ctx.chat?.id) && isChatTopicMessage(ctx.message);
}

export async function warnIfBridgeCannotRead(telegram) {
  const chatId = getGroupChatId();
  if (!chatId) {
    return;
  }
  try {
    const me = await telegram.getMe();
    const member = await telegram.getChatMember(chatId, me.id);
    if (!['administrator', 'creator'].includes(member.status)) {
      console.warn(`[bridge] bot is ${member.status} in ${chatId} — it will not see group messages until it is admin or privacy mode is disabled in BotFather`);
    }
  } catch (err) {
    console.warn('[bridge] cannot check group membership:', err.message);
  }
  if (!getThreadId('chat')) {
    console.warn('[bridge] chat topic id is empty — fill TOPIC_THREADS.chat in app/constants/access.js');
  }
}

function messageText(message) {
  const raw = message?.text || message?.caption || '';
  return stripMcColor(String(raw).replace(/[\r\n]+/g, ' ')).trim();
}

function ignoreReason(ctx) {
  const message = ctx.message;
  if (!message) {
    return 'no message';
  }
  if (ctx.from?.id && ctx.botInfo?.id && ctx.from.id === ctx.botInfo.id) {
    return 'own message';
  }
  if (message.is_automatic_forward) {
    return 'channel forward';
  }
  if (ctx.from?.is_bot && !message.sender_chat) {
    return 'bot';
  }
  return null;
}

export function logForeignGroup(ctx) {
  const chat = ctx.chat;
  if (!chat || !['group', 'supergroup'].includes(chat.type)) {
    return;
  }
  const key = String(chat.id);
  if (skipLog.has(key)) {
    return;
  }
  skipLog.add(key);
  const title = chat.title || '';
  console.info(`[bridge] saw ${chat.type} ${chat.id}${title ? ` «${title}»` : ''} — set GROUP_ID to this value if this is the forum group`);
}

export async function relayTelegramChat(ctx, next) {
  if (!isForumGroup(ctx.chat?.id)) {
    logForeignGroup(ctx);
    return next();
  }
  if (!isChatTopicMessage(ctx.message)) {
    return;
  }

  const ignored = ignoreReason(ctx);
  if (ignored) {
    console.info(`[bridge] skip: ${ignored}`);
    return;
  }

  const text = messageText(ctx.message);
  if (!text) {
    console.info('[bridge] skip: no text');
    return;
  }
  if (text.startsWith('/')) {
    return;
  }

  const name = speakerName(ctx);
  const line = `${name}: ${text}`.slice(0, MAX_TEXT);
  try {
    await rconSend(`say ${line}`);
    console.info(`[bridge] ${line.slice(0, 120)}`);
  } catch (err) {
    console.warn('[bridge]', err.message);
  }
}

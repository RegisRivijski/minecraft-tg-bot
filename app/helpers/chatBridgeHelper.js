import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { CHAT_ID } from '../constants/access.js';
import { getChannelId } from './channelHelper.js';
import { stripMcColor } from './minecraftHelper.js';

const MAX_TEXT = 200;

let linkedChatId = null;
let skipLog = new Set();

export function getRelayChatId() {
  const configured = Number(CHAT_ID);
  if (Number.isFinite(configured) && configured !== 0) {
    return configured;
  }
  return linkedChatId;
}

export function isRelayChat(chatId) {
  const id = getRelayChatId();
  return id != null && Number(chatId) === id;
}

export async function resolveRelayChat(telegram) {
  if (getRelayChatId()) {
    return getRelayChatId();
  }

  const channelId = getChannelId();
  if (!channelId) {
    console.warn('[bridge] CHAT_ID is empty — fill app/constants/access.js');
    return null;
  }

  try {
    const chat = await telegram.getChat(channelId);
    const linked = Number(chat.linked_chat_id);
    if (Number.isFinite(linked) && linked !== 0) {
      linkedChatId = linked;
      console.info(`[bridge] using linked discussion group ${linked}`);
      return linked;
    }
  } catch (err) {
    console.warn('[bridge] cannot read channel for linked chat:', err.message);
  }

  console.warn('[bridge] CHAT_ID is empty and the channel has no discussion group');
  return null;
}

export async function warnIfBridgeCannotRead(telegram) {
  const chatId = getRelayChatId();
  if (!chatId) {
    return;
  }
  if (getChannelId() && chatId === getChannelId()) {
    console.warn('[bridge] CHAT_ID matches CHANNEL_ID — use a group, not the feed channel');
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
}

function speakerName(ctx) {
  const senderChat = (ctx.message || ctx.channelPost)?.sender_chat;
  if (senderChat?.title) {
    return String(senderChat.title).replace(/[\r\n]+/g, ' ').trim();
  }
  const from = ctx.from || {};
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
    || from.username
    || String(from.id || 'Telegram');
  return String(name).replace(/[\r\n]+/g, ' ').trim();
}

function messagePayload(ctx) {
  return ctx.message || ctx.channelPost || null;
}

function messageText(message) {
  const raw = message?.text || message?.caption || '';
  return stripMcColor(String(raw).replace(/[\r\n]+/g, ' ')).trim();
}

function ignoreReason(ctx) {
  const message = messagePayload(ctx);
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
  console.info(`[bridge] saw ${chat.type} ${chat.id}${title ? ` «${title}»` : ''} — set CHAT_ID to this value to relay messages`);
}

export async function relayTelegramChat(ctx, next) {
  if (!isRelayChat(ctx.chat?.id)) {
    logForeignGroup(ctx);
    return next();
  }

  const ignored = ignoreReason(ctx);
  if (ignored) {
    console.info(`[bridge] skip: ${ignored}`);
    return;
  }

  const text = messageText(messagePayload(ctx));
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

import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { CHAT_ID } from '../constants/access.js';
import { stripMcColor } from './minecraftHelper.js';

const MAX_TEXT = 200;

let missingLogged = false;

export function getRelayChatId() {
  const id = Number(CHAT_ID);
  if (!Number.isFinite(id) || id === 0) {
    return null;
  }
  return id;
}

export function isRelayChat(chatId) {
  const id = getRelayChatId();
  return id != null && Number(chatId) === id;
}

function speakerName(from = {}) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
    || from.username
    || String(from.id || 'Telegram');
  return String(name).replace(/[\r\n]+/g, ' ').trim();
}

function messageText(message) {
  const raw = message?.text || message?.caption || '';
  return stripMcColor(String(raw).replace(/[\r\n]+/g, ' ')).trim();
}

function shouldIgnore(ctx) {
  const message = ctx.message;
  if (!message) {
    return true;
  }
  if (message.from?.is_bot) {
    return true;
  }
  if (message.sender_chat) {
    return true;
  }
  if (message.is_automatic_forward) {
    return true;
  }
  return false;
}

export async function relayTelegramChat(ctx, next) {
  if (!isRelayChat(ctx.chat?.id)) {
    return next();
  }
  if (shouldIgnore(ctx)) {
    return;
  }

  const text = messageText(ctx.message);
  if (!text || text.startsWith('/')) {
    return;
  }

  const name = speakerName(ctx.from);
  const line = `${name}: ${text}`.slice(0, MAX_TEXT);
  try {
    await rconSend(`say ${line}`);
    console.info(`[bridge] ${line.slice(0, 120)}`);
  } catch (err) {
    console.warn('[bridge]', err.message);
  }
}

export function warnIfRelayChatMissing() {
  if (getRelayChatId() || missingLogged) {
    return;
  }
  missingLogged = true;
  console.warn('[bridge] CHAT_ID is empty — fill app/constants/access.js');
}

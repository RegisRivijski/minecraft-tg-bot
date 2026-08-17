import { CHANNEL_ID } from '../constants/access.js';
import { HTML } from './copyHelper.js';

let missingLogged = false;

export function getChannelId() {
  const id = Number(CHANNEL_ID);
  if (!Number.isFinite(id) || id === 0) {
    return null;
  }
  return id;
}

export async function postToChannel(telegram, text, extra = HTML) {
  const chatId = getChannelId();
  if (!chatId) {
    if (!missingLogged) {
      console.warn('[channel] CHANNEL_ID is empty — fill app/constants/access.js');
      missingLogged = true;
    }
    return;
  }
  if (!text) {
    return;
  }
  try {
    await telegram.sendMessage(chatId, text, extra);
  } catch (err) {
    console.warn(`[channel] ${chatId}:`, err.message);
  }
}

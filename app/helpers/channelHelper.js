import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNEL_ID, CHAT_ID } from '../constants/access.js';
import { HTML } from './copyHelper.js';

const WEATHER_IMAGES = {
  clear: fileURLToPath(new URL('../assets/weather/clear.jpg', import.meta.url)),
  rain: fileURLToPath(new URL('../assets/weather/rain.jpg', import.meta.url)),
  thunder: fileURLToPath(new URL('../assets/weather/thunder.jpg', import.meta.url)),
};

const MOON_IMAGES = {
  full: fileURLToPath(new URL('../assets/moon/full.jpg', import.meta.url)),
  new: fileURLToPath(new URL('../assets/moon/new.jpg', import.meta.url)),
};

let linkedChatId = null;
let missingChannelLogged = false;
let missingGroupLogged = false;

export function getChannelId() {
  const id = Number(CHANNEL_ID);
  if (!Number.isFinite(id) || id === 0) {
    return null;
  }
  return id;
}

export function setLinkedChatId(id) {
  const linked = Number(id);
  linkedChatId = Number.isFinite(linked) && linked !== 0 ? linked : null;
}

export function getGroupChatId() {
  const configured = Number(CHAT_ID);
  if (Number.isFinite(configured) && configured !== 0) {
    return configured;
  }
  return linkedChatId;
}

async function imagePath(map, key) {
  const file = map[key];
  if (!file) {
    return null;
  }
  try {
    await access(file);
    return file;
  } catch {
    return null;
  }
}

function weatherImagePath(key) {
  return imagePath(WEATHER_IMAGES, key);
}

function moonImagePath(key) {
  return imagePath(MOON_IMAGES, key);
}

async function sendText(telegram, chatId, text, extra, warnPrefix) {
  if (!text) {
    return;
  }
  try {
    await telegram.sendMessage(chatId, text, extra);
  } catch (err) {
    console.warn(`${warnPrefix} ${chatId}:`, err.message);
  }
}

export async function postToChannel(telegram, text, extra = HTML) {
  const chatId = getChannelId();
  if (!chatId) {
    if (!missingChannelLogged) {
      console.warn('[channel] CHANNEL_ID is empty — fill app/constants/access.js');
      missingChannelLogged = true;
    }
    return;
  }
  await sendText(telegram, chatId, text, extra, '[channel]');
}

export async function postToGroup(telegram, text, extra = HTML) {
  const chatId = getGroupChatId();
  if (!chatId) {
    if (!missingGroupLogged) {
      console.warn('[group] CHAT_ID is empty — fill app/constants/access.js');
      missingGroupLogged = true;
    }
    return;
  }
  await sendText(telegram, chatId, text, extra, '[group]');
}

export async function postPhotoToChannel(telegram, photoPath, caption, extra = HTML) {
  const chatId = getChannelId();
  if (!chatId) {
    if (!missingChannelLogged) {
      console.warn('[channel] CHANNEL_ID is empty — fill app/constants/access.js');
      missingChannelLogged = true;
    }
    return;
  }
  try {
    await telegram.sendPhoto(
      chatId,
      { source: createReadStream(photoPath) },
      { caption: caption || undefined, ...extra },
    );
  } catch (err) {
    console.warn(`[channel] photo ${path.basename(photoPath)}:`, err.message);
    if (caption) {
      await postToChannel(telegram, caption, extra);
    }
  }
}

export async function postWeatherChange(telegram, caption, weatherKey) {
  const image = await weatherImagePath(weatherKey);
  if (image) {
    await postPhotoToChannel(telegram, image, caption);
    return;
  }
  await postToChannel(telegram, caption);
}

export async function postMoonChange(telegram, caption, moonKey) {
  const image = await moonImagePath(moonKey);
  if (image) {
    await postPhotoToChannel(telegram, image, caption);
    return;
  }
  await postToChannel(telegram, caption);
}

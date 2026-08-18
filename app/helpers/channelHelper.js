import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNEL_ID, CHAT_ID } from '../constants/access.js';
import { HTML } from './copyHelper.js';

function weatherAsset(name) {
  return fileURLToPath(new URL(`../assets/weather/${name}.jpg`, import.meta.url));
}

const WEATHER_IMAGES = {
  clear: weatherAsset('clear'),
  rain: weatherAsset('rain'),
  thunder: weatherAsset('thunder'),
};

function phaseImages(weather, dayFile = weather) {
  return {
    sunrise: weatherAsset(`${weather}-sunrise`),
    morning: weatherAsset(`${weather}-morning`),
    noon: weatherAsset(`${weather}-noon`),
    day: weatherAsset(dayFile),
    sunset: weatherAsset(`${weather}-sunset`),
    night: weatherAsset(`${weather}-night`),
    midnight: weatherAsset(`${weather}-midnight`),
  };
}

const WEATHER_PHASE_IMAGES = {
  clear: phaseImages('clear'),
  rain: phaseImages('rain', 'rain-day'),
  thunder: phaseImages('thunder', 'thunder-day'),
};

function moonAsset(name) {
  return fileURLToPath(new URL(`../assets/moon/${name}.jpg`, import.meta.url));
}

const MOON_IMAGES = {
  full: moonAsset('full'),
  new: moonAsset('new'),
};

const MOON_WEATHER_IMAGES = {
  full: {
    clear: moonAsset('full'),
    rain: moonAsset('full-rain'),
    thunder: moonAsset('full-thunder'),
  },
  new: {
    clear: moonAsset('new'),
    rain: moonAsset('new-rain'),
    thunder: moonAsset('new-thunder'),
  },
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

async function weatherImagePath(key, phase) {
  const timed = await imagePath(WEATHER_PHASE_IMAGES[key], phase);
  if (timed) {
    return timed;
  }
  return imagePath(WEATHER_IMAGES, key);
}

async function moonImagePath(key, weatherKey) {
  const byWeather = await imagePath(MOON_WEATHER_IMAGES[key], weatherKey);
  if (byWeather) {
    return byWeather;
  }
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

export async function postWeatherChange(telegram, caption, weatherKey, daytime) {
  const image = await weatherImagePath(weatherKey, daytime?.phase);
  if (image) {
    await postPhotoToChannel(telegram, image, caption);
    return;
  }
  await postToChannel(telegram, caption);
}

export async function postMoonChange(telegram, caption, moonKey, weatherKey) {
  const image = await moonImagePath(moonKey, weatherKey);
  if (image) {
    await postPhotoToChannel(telegram, image, caption);
    return;
  }
  await postToChannel(telegram, caption);
}

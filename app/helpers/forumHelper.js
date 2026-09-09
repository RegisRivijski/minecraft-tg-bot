import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from '../../config/default.js';
import { GROUP_ID, TOPIC_THREADS } from '../constants/access.js';
import { HTML } from './copyHelper.js';

const TOPIC_KEYS = ['weather', 'events', 'chat'];

function weatherAsset(name) {
  return `weather/${name}.jpg`;
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
  return `moon/${name}.jpg`;
}

function localAssetPath(relativePath) {
  return fileURLToPath(new URL(`../assets/${relativePath}`, import.meta.url));
}

function publicAssetUrl(relativePath) {
  const base = config.assets.baseUrl;
  if (!base) {
    return null;
  }
  return `${base}/${relativePath}`;
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

const missingTopicLogged = new Set();
let missingGroupLogged = false;

function asThreadId(value) {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 1) {
    return null;
  }
  return id;
}

export function getGroupChatId() {
  const id = Number(GROUP_ID);
  if (!Number.isFinite(id) || id === 0) {
    return null;
  }
  return id;
}

export function isForumGroup(chatId) {
  const id = getGroupChatId();
  return id != null && Number(chatId) === id;
}

export function getThreadId(key) {
  return asThreadId(TOPIC_THREADS[key]);
}

export function getForumSummary() {
  return {
    group: getGroupChatId() || GROUP_ID || '—',
    weather: getThreadId('weather') || '—',
    events: getThreadId('events') || '—',
    chat: getThreadId('chat') || '—',
  };
}

export function isGeneralTopic(message) {
  if (!message) {
    return true;
  }
  if (message.is_topic_message) {
    return asThreadId(message.message_thread_id) == null;
  }
  return true;
}

export function isChatTopicMessage(message) {
  if (!message?.is_topic_message) {
    return false;
  }
  const chatThread = getThreadId('chat');
  return chatThread != null && Number(message.message_thread_id) === chatThread;
}

export async function warnIfForumMisconfigured(telegram) {
  const chatId = getGroupChatId();
  if (!chatId) {
    console.warn('[forum] GROUP_ID is empty — fill app/constants/access.js');
    return;
  }
  try {
    const chat = await telegram.getChat(chatId);
    if (!chat.is_forum) {
      console.warn(`[forum] ${chatId} is not a forum — enable Topics in the group settings`);
    }
  } catch (err) {
    console.warn('[forum] cannot read group:', err.message);
  }
  for (const key of TOPIC_KEYS) {
    if (!getThreadId(key)) {
      console.warn(`[forum] ${key} thread id is empty — fill TOPIC_THREADS in app/constants/access.js`);
    }
  }
}

async function imagePath(map, key) {
  const relativePath = map[key];
  if (!relativePath) {
    return null;
  }
  try {
    await access(localAssetPath(relativePath));
    return relativePath;
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

function topicExtra(topicKey, extra = {}) {
  const chatId = getGroupChatId();
  const threadId = getThreadId(topicKey);
  if (!chatId) {
    if (!missingGroupLogged) {
      console.warn('[forum] GROUP_ID is empty — fill app/constants/access.js');
      missingGroupLogged = true;
    }
    return null;
  }
  if (!threadId) {
    if (!missingTopicLogged.has(topicKey)) {
      console.warn(`[forum] skip ${topicKey}: thread id is empty — fill TOPIC_THREADS in app/constants/access.js`);
      missingTopicLogged.add(topicKey);
    }
    return null;
  }
  return { chatId, extra: { ...extra, message_thread_id: threadId } };
}

async function sendText(telegram, topicKey, text, extra) {
  if (!text) {
    return;
  }
  const target = topicExtra(topicKey, extra);
  if (!target) {
    return;
  }
  try {
    await telegram.sendMessage(target.chatId, text, target.extra);
  } catch (err) {
    console.warn(`[forum] ${topicKey} ${target.chatId}/${target.extra.message_thread_id}:`, err.message);
  }
}

async function sendLocalPhoto(telegram, target, relativePath, caption) {
  await telegram.sendPhoto(
    target.chatId,
    { source: createReadStream(localAssetPath(relativePath)) },
    { caption: caption || undefined, ...target.extra },
  );
}

async function sendPhoto(telegram, topicKey, relativePath, caption, extra) {
  const target = topicExtra(topicKey, extra);
  if (!target) {
    return;
  }
  const url = publicAssetUrl(relativePath);
  if (url) {
    try {
      await telegram.sendPhoto(
        target.chatId,
        url,
        { caption: caption || undefined, ...target.extra },
      );
      return;
    } catch (err) {
      console.warn(`[forum] ${topicKey} photo url ${url}:`, err.message);
    }
  }
  try {
    await sendLocalPhoto(telegram, target, relativePath, caption);
  } catch (err) {
    console.warn(`[forum] ${topicKey} photo ${path.basename(relativePath)}:`, err.message);
    if (caption) {
      await sendText(telegram, topicKey, caption, extra);
    }
  }
}

async function postPhotoOrText(telegram, topicKey, photoPath, caption, extra = HTML) {
  if (photoPath) {
    await sendPhoto(telegram, topicKey, photoPath, caption, extra);
    return;
  }
  await sendText(telegram, topicKey, caption, extra);
}

export async function postToEvents(telegram, text, extra = HTML) {
  await sendText(telegram, 'events', text, extra);
}

export async function postToChat(telegram, text, extra = HTML) {
  await sendText(telegram, 'chat', text, extra);
}

export async function postWeatherChange(telegram, caption, weatherKey, daytime) {
  const image = await weatherImagePath(weatherKey, daytime?.phase);
  await postPhotoOrText(telegram, 'weather', image, caption);
}

export async function postMoonChange(telegram, caption, moonKey, weatherKey) {
  const image = await moonImagePath(moonKey, weatherKey);
  await postPhotoOrText(telegram, 'weather', image, caption);
}

export async function postOnlineDigest(telegram, caption, weatherKey, daytime) {
  const image = await weatherImagePath(weatherKey, daytime?.phase);
  await postPhotoOrText(telegram, 'events', image, caption);
}

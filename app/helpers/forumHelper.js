import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from '../../config/default.js';
import { GROUP_ID, TOPIC_THREADS } from '../constants/access.js';
import { HTML } from './copyHelper.js';

const TOPIC_KEYS = ['events', 'chat', 'status'];

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
  waning_gibbous: moonAsset('waning-gibbous'),
  third_quarter: moonAsset('third-quarter'),
  waning_crescent: moonAsset('waning-crescent'),
  new: moonAsset('new'),
  waxing_crescent: moonAsset('waxing-crescent'),
  first_quarter: moonAsset('first-quarter'),
  waxing_gibbous: moonAsset('waxing-gibbous'),
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
let statusCannotPost = false;
let statusCannotPostLogged = false;

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
    events: getThreadId('events') || '—',
    chat: getThreadId('chat') || '—',
    status: getThreadId('status') || '—',
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

const localAssetCache = new Map();

async function localAssetExists(relativePath) {
  if (localAssetCache.has(relativePath)) {
    return localAssetCache.get(relativePath);
  }
  try {
    await access(localAssetPath(relativePath));
    localAssetCache.set(relativePath, true);
    return true;
  } catch {
    localAssetCache.set(relativePath, false);
    return false;
  }
}

async function imagePath(map, key) {
  const relativePath = map?.[key];
  if (!relativePath) {
    return null;
  }
  if (publicAssetUrl(relativePath) || await localAssetExists(relativePath)) {
    return relativePath;
  }
  return null;
}

function weatherKeyOrClear(key) {
  return WEATHER_IMAGES[key] ? key : 'clear';
}

async function weatherImagePath(key, phase) {
  const weather = weatherKeyOrClear(key);
  const timed = await imagePath(WEATHER_PHASE_IMAGES[weather], phase);
  if (timed) {
    return timed;
  }
  return imagePath(WEATHER_IMAGES, weather);
}

async function moonImagePath(key, weatherKey) {
  const byWeather = await imagePath(MOON_WEATHER_IMAGES[key], weatherKey);
  if (byWeather) {
    return byWeather;
  }
  return imagePath(MOON_IMAGES, key);
}

function isNightPhase(phase) {
  return phase === 'night' || phase === 'midnight';
}

export async function statusBoardImagePath({ weatherKey, daytime, moon }) {
  const weather = weatherKeyOrClear(weatherKey);
  if (isNightPhase(daytime?.phase) && moon?.key) {
    const moonImage = await moonImagePath(moon.key, weather);
    if (moonImage) {
      return moonImage;
    }
  }
  return (await weatherImagePath(weather, daytime?.phase))
    || WEATHER_PHASE_IMAGES[weather]?.[daytime?.phase]
    || WEATHER_IMAGES[weather]
    || WEATHER_IMAGES.clear;
}

function photoFileId(message) {
  const sizes = message?.photo;
  if (!Array.isArray(sizes) || !sizes.length) {
    return null;
  }
  return sizes[sizes.length - 1]?.file_id || null;
}

function telegramErrorText(err) {
  return err?.response?.description || err?.description || err?.message || '';
}

function isNotModified(err) {
  return /message is not modified/i.test(telegramErrorText(err));
}

function isMissingMessage(err) {
  return /message to edit not found|MESSAGE_ID_INVALID|message can't be edited|message to be replied not found/i.test(
    telegramErrorText(err),
  );
}

function cannotEditAsPhoto(err) {
  return /there is no (media|photo)|message is not a photo|no caption in the message/i.test(
    telegramErrorText(err),
  );
}

function isTopicClosed(err) {
  return /TOPIC_CLOSED/i.test(telegramErrorText(err));
}

function rememberFileId(fileIds, relativePath, message) {
  const fileId = photoFileId(message);
  if (relativePath && fileId) {
    fileIds[relativePath] = fileId;
  }
}

async function nginxPhoto(relativePath) {
  const url = publicAssetUrl(relativePath);
  if (!url) {
    return null;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`asset ${response.status} ${url}`);
  }
  return {
    source: Buffer.from(await response.arrayBuffer()),
    filename: path.basename(relativePath),
  };
}

let nginxFetchWarned = false;

async function photoMedia(relativePath, fileIds = {}) {
  if (fileIds[relativePath]) {
    return fileIds[relativePath];
  }
  const url = publicAssetUrl(relativePath);
  if (url) {
    try {
      return await nginxPhoto(relativePath);
    } catch (err) {
      if (!nginxFetchWarned) {
        nginxFetchWarned = true;
        console.warn('[forum] nginx fetch failed:', err.message);
      }
    }
  }
  return {
    source: createReadStream(localAssetPath(relativePath)),
    filename: path.basename(relativePath),
  };
}

async function withOpenTopic(telegram, chatId, threadId, task) {
  let opened = false;
  try {
    await telegram.reopenForumTopic(chatId, threadId);
    opened = true;
  } catch (err) {
    if (!/TOPIC_NOT_MODIFIED|not closed/i.test(telegramErrorText(err)) && !isTopicClosed(err)) {
      // Already open, or the bot cannot manage topics.
    }
  }
  try {
    return await task();
  } finally {
    if (opened) {
      try {
        await telegram.closeForumTopic(chatId, threadId);
      } catch {
        // Leave the topic as-is if close fails.
      }
    }
  }
}

async function pinSilent(telegram, chatId, messageId) {
  try {
    await telegram.pinChatMessage(chatId, messageId, { disable_notification: true });
  } catch (err) {
    if (!/already pinned|CHAT_NOT_MODIFIED/i.test(telegramErrorText(err))) {
      console.warn(`[forum] pin ${chatId}/${messageId}:`, err.message);
    }
  }
}

async function deleteSilent(telegram, chatId, messageId) {
  if (!messageId) {
    return;
  }
  try {
    await telegram.deleteMessage(chatId, messageId);
  } catch {
    // The previous board message can already be gone.
  }
}

async function editBoardPhoto(telegram, chatId, messageId, relativePath, caption, fileIds) {
  return telegram.editMessageMedia(chatId, messageId, undefined, {
    type: 'photo',
    media: await photoMedia(relativePath, fileIds),
    caption: caption || undefined,
    parse_mode: 'HTML',
  });
}

function savedPointer({ messageId, chatId, threadId, fileIds, relativePath, caption, hasPhoto }) {
  return {
    messageId,
    chatId,
    threadId,
    fileIds,
    imagePath: relativePath,
    caption,
    hasPhoto,
  };
}

export async function upsertPinnedStatusBoard(telegram, caption, relativePath, pointer = {}) {
  const target = topicExtra('status', HTML);
  if (!target || !caption || !relativePath) {
    return pointer;
  }

  const { chatId } = target;
  const threadId = target.extra.message_thread_id;
  const extra = { caption: caption || undefined, ...target.extra };
  const fileIds = { ...(pointer.fileIds || {}) };
  const samePlace = Boolean(pointer.messageId)
    && (pointer.chatId == null || pointer.chatId === chatId)
    && (pointer.threadId == null || pointer.threadId === threadId);
  const messageId = samePlace ? pointer.messageId : null;
  const hasPhoto = samePlace ? Boolean(pointer.hasPhoto) : false;

  const sendNew = async (replaceId = null) => withOpenTopic(telegram, chatId, threadId, async () => {
    const message = await telegram.sendPhoto(chatId, await photoMedia(relativePath, fileIds), extra);
    const id = message?.message_id;
    if (!id) {
      return pointer;
    }
    rememberFileId(fileIds, relativePath, message);
    await pinSilent(telegram, chatId, id);
    if (replaceId && replaceId !== id) {
      await deleteSilent(telegram, chatId, replaceId);
    }
    console.info(`[status] posted ${chatId}/${threadId}/${id} ${relativePath}`);
    return savedPointer({
      messageId: id, chatId, threadId, fileIds, relativePath, caption, hasPhoto: true,
    });
  });

  const editPhoto = async () => {
    let message;
    if (pointer.imagePath !== relativePath) {
      message = await editBoardPhoto(telegram, chatId, messageId, relativePath, caption, fileIds);
    } else if (pointer.caption !== caption) {
      message = await telegram.editMessageCaption(chatId, messageId, undefined, caption, HTML);
    } else {
      return pointer;
    }
    rememberFileId(fileIds, relativePath, message);
    return savedPointer({
      messageId, chatId, threadId, fileIds, relativePath, caption, hasPhoto: true,
    });
  };

  const editText = async () => {
    if (pointer.caption === caption && samePlace) {
      return pointer;
    }
    await telegram.editMessageText(chatId, messageId, undefined, caption, HTML);
    return savedPointer({
      messageId, chatId, threadId, fileIds, relativePath, caption, hasPhoto: false,
    });
  };

  if (messageId && hasPhoto) {
    try {
      return await editPhoto();
    } catch (err) {
      if (isNotModified(err)) {
        return savedPointer({
          messageId, chatId, threadId, fileIds, relativePath, caption, hasPhoto: true,
        });
      }
      if (!isMissingMessage(err) && !cannotEditAsPhoto(err)) {
        console.warn(`[forum] status edit ${chatId}/${messageId}:`, err.message);
        return pointer;
      }
    }
  }

  if (messageId && !hasPhoto && statusCannotPost) {
    try {
      return await editText();
    } catch (err) {
      if (isNotModified(err)) {
        return pointer;
      }
      console.warn(`[forum] status text ${chatId}/${messageId}:`, err.message);
      return pointer;
    }
  }

  try {
    return await sendNew(messageId);
  } catch (err) {
    if (isTopicClosed(err)) {
      statusCannotPost = true;
      if (!statusCannotPostLogged) {
        statusCannotPostLogged = true;
        console.warn('[status] topic is closed; editing the saved message instead of posting a new one');
      }
    }
    if (messageId && !isMissingMessage(err)) {
      try {
        if (hasPhoto) {
          await telegram.editMessageCaption(chatId, messageId, undefined, caption, HTML);
          return savedPointer({
            messageId, chatId, threadId, fileIds, relativePath, caption, hasPhoto: true,
          });
        }
        return await editText();
      } catch (editErr) {
        if (isNotModified(editErr)) {
          return pointer;
        }
        console.warn(`[forum] status fallback ${chatId}/${messageId}:`, editErr.message);
      }
    }
    if (!isTopicClosed(err) || !messageId) {
      console.warn(`[forum] status send ${chatId}/${threadId}:`, err.message);
    }
    return messageId
      ? savedPointer({
        messageId, chatId, threadId, fileIds, relativePath, caption, hasPhoto,
      })
      : pointer;
  }
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

export async function postToEvents(telegram, text, extra = HTML) {
  await sendText(telegram, 'events', text, extra);
}

export async function postToChat(telegram, text, extra = HTML) {
  await sendText(telegram, 'chat', text, extra);
}

import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from '../../config/default.js';
import { GROUP_ID, TOPIC_THREADS } from '../constants/access.js';
import { HTML } from './copyHelper.js';

const TOPIC_KEYS = ['weather', 'events', 'chat', 'status'];

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

function isNightPhase(phase) {
  return phase === 'night' || phase === 'midnight';
}

export async function statusBoardImagePath({ weatherKey, daytime, moon }) {
  if (isNightPhase(daytime?.phase) && moon?.key) {
    const moonImage = await moonImagePath(moon.key, weatherKey);
    if (moonImage) {
      return moonImage;
    }
  }
  return weatherImagePath(weatherKey, daytime?.phase);
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

function photoInput(relativePath, fileIds = {}) {
  if (fileIds[relativePath]) {
    return fileIds[relativePath];
  }
  const url = publicAssetUrl(relativePath);
  if (url) {
    return url;
  }
  return { source: createReadStream(localAssetPath(relativePath)) };
}

const pinnedThisRun = new Set();

async function pinSilent(telegram, chatId, messageId) {
  const key = `${chatId}:${messageId}`;
  if (pinnedThisRun.has(key)) {
    return;
  }
  try {
    await telegram.pinChatMessage(chatId, messageId, { disable_notification: true });
    pinnedThisRun.add(key);
  } catch (err) {
    if (/already pinned|CHAT_NOT_MODIFIED/i.test(telegramErrorText(err))) {
      pinnedThisRun.add(key);
      return;
    }
    console.warn(`[forum] pin ${chatId}/${messageId}:`, err.message);
  }
}

function rememberFileId(fileIds, relativePath, message) {
  const fileId = photoFileId(message);
  if (relativePath && fileId) {
    fileIds[relativePath] = fileId;
  }
}

async function sendBoardPhoto(telegram, target, relativePath, caption, fileIds) {
  const extra = { caption: caption || undefined, ...target.extra };
  const cached = fileIds[relativePath];
  if (cached) {
    try {
      return await telegram.sendPhoto(target.chatId, cached, extra);
    } catch (err) {
      console.warn('[forum] status file_id:', err.message);
      delete fileIds[relativePath];
    }
  }
  const url = publicAssetUrl(relativePath);
  if (url) {
    try {
      return await telegram.sendPhoto(target.chatId, url, extra);
    } catch (err) {
      console.warn(`[forum] status photo url ${url}:`, err.message);
    }
  }
  return telegram.sendPhoto(
    target.chatId,
    { source: createReadStream(localAssetPath(relativePath)) },
    extra,
  );
}

async function editBoardPhoto(telegram, chatId, messageId, relativePath, caption, fileIds) {
  const cached = fileIds[relativePath];
  try {
    return await telegram.editMessageMedia(chatId, messageId, undefined, {
      type: 'photo',
      media: photoInput(relativePath, fileIds),
      caption: caption || undefined,
      parse_mode: 'HTML',
    });
  } catch (err) {
    if (isNotModified(err) || isMissingMessage(err) || cannotEditAsPhoto(err) || !cached) {
      throw err;
    }
    delete fileIds[relativePath];
    return telegram.editMessageMedia(chatId, messageId, undefined, {
      type: 'photo',
      media: photoInput(relativePath, fileIds),
      caption: caption || undefined,
      parse_mode: 'HTML',
    });
  }
}

export async function upsertPinnedStatusBoard(telegram, caption, relativePath, pointer = {}) {
  const target = topicExtra('status', HTML);
  if (!target || !caption) {
    return pointer;
  }

  const { chatId, extra } = target;
  const threadId = extra.message_thread_id;
  const fileIds = { ...(pointer.fileIds || {}) };
  const samePlace = pointer.chatId === chatId && pointer.threadId === threadId;
  let messageId = samePlace ? pointer.messageId : null;
  const hasPhoto = samePlace ? Boolean(pointer.hasPhoto) : false;

  const sendNew = async () => {
    const message = relativePath
      ? await sendBoardPhoto(telegram, target, relativePath, caption, fileIds)
      : await telegram.sendMessage(chatId, caption, extra);
    const id = message?.message_id;
    if (!id) {
      return pointer;
    }
    rememberFileId(fileIds, relativePath, message);
    await pinSilent(telegram, chatId, id);
    console.info(`[status] posted ${chatId}/${threadId}/${id}`);
    return {
      messageId: id,
      chatId,
      threadId,
      fileIds,
      imagePath: relativePath || null,
      caption,
      hasPhoto: Boolean(relativePath),
    };
  };

  if (!messageId || (relativePath && !hasPhoto)) {
    try {
      return await sendNew();
    } catch (err) {
      console.warn(`[forum] status send ${chatId}/${threadId}:`, err.message);
      return pointer;
    }
  }

  try {
    let message;
    if (relativePath && pointer.imagePath !== relativePath) {
      message = await editBoardPhoto(telegram, chatId, messageId, relativePath, caption, fileIds);
    } else if (pointer.caption !== caption) {
      message = relativePath || hasPhoto
        ? await telegram.editMessageCaption(chatId, messageId, undefined, caption, HTML)
        : await telegram.editMessageText(chatId, messageId, undefined, caption, HTML);
    } else {
      await pinSilent(telegram, chatId, messageId);
      return pointer;
    }
    rememberFileId(fileIds, relativePath, message);
    return {
      messageId,
      chatId,
      threadId,
      fileIds,
      imagePath: relativePath || pointer.imagePath || null,
      caption,
      hasPhoto: hasPhoto || Boolean(relativePath),
    };
  } catch (err) {
    if (isNotModified(err)) {
      return {
        messageId,
        chatId,
        threadId,
        fileIds,
        imagePath: relativePath || pointer.imagePath || null,
        caption,
        hasPhoto: hasPhoto || Boolean(relativePath),
      };
    }
    if (isMissingMessage(err) || cannotEditAsPhoto(err)) {
      try {
        return await sendNew();
      } catch (sendErr) {
        console.warn(`[forum] status resend ${chatId}/${threadId}:`, sendErr.message);
        return pointer;
      }
    }
    console.warn(`[forum] status edit ${chatId}/${messageId}:`, err.message);
    return pointer;
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

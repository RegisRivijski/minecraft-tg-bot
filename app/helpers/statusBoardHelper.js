import fs from 'node:fs/promises';
import path from 'node:path';

import config from '../../config/default.js';
import { statusBoardText } from './copyHelper.js';
import { statusBoardImagePath, upsertPinnedStatusBoard } from './forumHelper.js';
import { fetchWorldSnapshot } from './serverHelper.js';

function storePath() {
  return path.join(path.dirname(config.server.statsPath), 'tg-bot-status-board.json');
}

async function loadPointer() {
  try {
    const raw = JSON.parse(await fs.readFile(storePath(), 'utf8'));
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    return {
      messageId: Number(raw.messageId) || null,
      chatId: Number(raw.chatId) || null,
      threadId: Number(raw.threadId) || null,
      fileIds: raw.fileIds && typeof raw.fileIds === 'object' && !Array.isArray(raw.fileIds)
        ? raw.fileIds
        : {},
      imagePath: raw.imagePath || null,
      caption: raw.caption || null,
      hasPhoto: Boolean(raw.hasPhoto) || Boolean(raw.imagePath),
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[status] read', err.message);
    }
    return {};
  }
}

async function savePointer(pointer) {
  const file = storePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(pointer, null, 2)}\n`);
  await fs.rename(tmp, file);
}

export function startStatusBoard(telegram) {
  let timer = null;
  let inFlight = false;
  let pointer = {};
  let loaded = false;

  const poll = async () => {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      if (!loaded) {
        pointer = await loadPointer();
        loaded = true;
      }
      const snapshot = await fetchWorldSnapshot();
      const caption = statusBoardText(snapshot);
      const imagePath = await statusBoardImagePath({
        weatherKey: snapshot.weather?.key,
        daytime: snapshot.daytime,
        moon: snapshot.moon,
      });
      const next = await upsertPinnedStatusBoard(telegram, caption, imagePath, pointer);
      if (next !== pointer) {
        pointer = next;
        await savePointer(pointer).catch((err) => console.warn('[status] save', err.message));
      }
    } catch (err) {
      console.warn('[status]', err.message);
    } finally {
      inFlight = false;
    }
  };

  timer = setInterval(poll, config.server.statusBoardPollMs);
  poll();
  console.info(`[status] polling every ${config.server.statusBoardPollMs}ms`);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

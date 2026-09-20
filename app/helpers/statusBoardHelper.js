import fs from 'node:fs/promises';
import path from 'node:path';

import config from '../../config/default.js';
import { statusBoardText } from './copyHelper.js';
import { statusBoardImagePath, upsertPinnedStatusBoard } from './forumHelper.js';
import { startPolling } from './pollHelper.js';
import { fetchWorldSnapshot } from './serverHelper.js';
import { getStatusBoard, setStatusBoard } from './worldStatsHelper.js';

function sidecarPath() {
  return path.join(path.dirname(config.server.statsPath), 'tg-bot-status-board.json');
}

async function loadSidecar() {
  try {
    const raw = JSON.parse(await fs.readFile(sidecarPath(), 'utf8'));
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    return raw;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[status] read', err.message);
    }
    return {};
  }
}

async function dropSidecar() {
  await fs.unlink(sidecarPath()).catch(() => {});
}

async function loadPointer() {
  const fromStats = getStatusBoard();
  if (fromStats?.messageId) {
    await dropSidecar();
    return fromStats;
  }
  const fromFile = await loadSidecar();
  if (fromFile?.messageId) {
    setStatusBoard(fromFile);
    await dropSidecar();
    return getStatusBoard() || fromFile;
  }
  return {};
}

export function startStatusBoard(telegram, { onSnapshot } = {}) {
  let pointer = {};
  let loaded = false;

  console.info(`[status] polling every ${config.server.statusBoardPollMs}ms`);
  return startPolling(async () => {
    if (!loaded) {
      pointer = await loadPointer();
      loaded = true;
      if (pointer.messageId) {
        console.info(`[status] resume message ${pointer.messageId} photo=${Boolean(pointer.hasPhoto)}`);
      }
    }
    const snapshot = await fetchWorldSnapshot();
    if (onSnapshot) {
      await onSnapshot(snapshot);
    }
    const caption = statusBoardText(snapshot);
    const imagePath = await statusBoardImagePath({
      weatherKey: snapshot.weather?.key,
      daytime: snapshot.daytime,
      moon: snapshot.moon,
    });
    const next = await upsertPinnedStatusBoard(telegram, caption, imagePath, pointer);
    if (next !== pointer) {
      pointer = next;
      if (pointer.messageId) {
        setStatusBoard(pointer);
      }
    }
  }, config.server.statusBoardPollMs, { name: 'status' });
}

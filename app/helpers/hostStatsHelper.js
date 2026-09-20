import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import config from '../../config/default.js';

const execFileAsync = promisify(execFile);
const CACHE_MS = 20000;

let cached = null;
let cachedAt = 0;

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value >= 1024 ** 3) {
    return `${(value / (1024 ** 3)).toFixed(1)} ГБ`;
  }
  if (value >= 1024 ** 2) {
    return `${Math.round(value / (1024 ** 2))} МБ`;
  }
  return `${Math.round(value / 1024)} КБ`;
}

function formatSavedAt(mtimeMs) {
  const at = Number(mtimeMs);
  if (!Number.isFinite(at) || at <= 0) {
    return null;
  }
  const zone = config.server.timeZone || 'Europe/Kyiv';
  const clock = new Intl.DateTimeFormat('ru-RU', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at));
  const elapsed = Date.now() - at;
  let ago;
  if (elapsed < 60_000) {
    ago = 'только что';
  } else if (elapsed < 3_600_000) {
    const minutes = Math.max(1, Math.round(elapsed / 60_000));
    ago = `${minutes} мин назад`;
  } else if (elapsed < 86_400_000) {
    const hours = Math.max(1, Math.round(elapsed / 3_600_000));
    ago = `${hours} ч назад`;
  } else {
    const days = Math.max(1, Math.round(elapsed / 86_400_000));
    ago = `${days} дн назад`;
  }
  return { clock, ago, at };
}

async function dataDirBytes() {
  try {
    const { stdout } = await execFileAsync('du', ['-sk', config.server.dataDir], {
      timeout: 20000,
    });
    const kilobytes = Number(String(stdout).trim().split(/\s+/)[0]);
    if (!Number.isFinite(kilobytes) || kilobytes < 0) {
      return null;
    }
    return kilobytes * 1024;
  } catch (err) {
    console.warn('[host] du', err.message);
    return null;
  }
}

async function lastSaveAt() {
  const world = config.server.worldPath;
  const preferred = path.join(world, 'level.dat');
  const fallbacks = [
    path.join(world, 'level.dat_old'),
    path.join(world, 'session.lock'),
  ];
  try {
    const stat = await fs.stat(preferred);
    const at = Number(stat.mtimeMs) || 0;
    if (at) {
      return at;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[host] stat', preferred, err.message);
    }
  }
  for (const file of fallbacks) {
    try {
      const stat = await fs.stat(file);
      const at = Number(stat.mtimeMs) || 0;
      if (at) {
        return at;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[host] stat', file, err.message);
      }
    }
  }
  return null;
}

export async function fetchHostStats() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) {
    return cached;
  }

  const [bytes, savedAt] = await Promise.all([dataDirBytes(), lastSaveAt()]);
  cached = {
    dataSize: formatBytes(bytes),
    saved: formatSavedAt(savedAt),
  };
  cachedAt = now;
  return cached;
}

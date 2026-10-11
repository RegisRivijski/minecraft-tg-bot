import fs from 'fs';
import path from 'node:path';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

function envString(name) {
  const value = process.env[name];
  return value ? value : undefined;
}

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const logPath = envString('MINECRAFT_LOG_PATH');
const serverRoot = logPath ? path.dirname(path.dirname(logPath)) : undefined;

export default {
  application: {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
  },
  bot: {
    apiToken: envString('MINECRAFT_TG_BOT_API_TOKEN'),
  },
  assets: {
    baseUrl: (envString('MINECRAFT_ASSETS_BASE_URL') || '').replace(/\/$/, ''),
  },
  telegramBotApi: {
    protocol: envString('TELEGRAM_BOT_API_PROTOCOL'),
    host: envString('TELEGRAM_BOT_API_HOST'),
    port: envString('TELEGRAM_BOT_API_PORT'),
  },
  rcon: {
    host: envString('MINECRAFT_RCON_HOST'),
    port: envNumber('MINECRAFT_RCON_PORT'),
    password: envString('MINECRAFT_RCON_PASSWORD'),
    timeoutMs: envNumber('MINECRAFT_RCON_TIMEOUT_MS', 5000),
  },
  server: {
    motd: envString('MINECRAFT_MOTD'),
    address: envString('MINECRAFT_ADDRESS'),
    pollIntervalMs: envNumber('MINECRAFT_POLL_INTERVAL_MS', 5000),
    logPath,
    logPollMs: envNumber('MINECRAFT_LOG_POLL_MS', 1000),
    statusBoardPollMs: envNumber('MINECRAFT_STATUS_BOARD_POLL_MS', 15000),
    tpsPollMs: envNumber('MINECRAFT_TPS_POLL_MS', 30000),
    tpsAlertBelow: envNumber('MINECRAFT_TPS_ALERT_BELOW', 15),
    tpsRecoverAt: envNumber('MINECRAFT_TPS_RECOVER_AT', 18),
    emptyWorldHours: String(process.env.MINECRAFT_EMPTY_WORLD_HOURS || '3,9,18')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0),
    dailyRecapHour: envNumber('MINECRAFT_DAILY_RECAP_HOUR', 21),
    weeklyRecapWeekday: envNumber('MINECRAFT_WEEKLY_RECAP_WEEKDAY', 0),
    recapPollMs: envNumber('MINECRAFT_RECAP_POLL_MS', 30000),
    dailyLoginEmeralds: Math.min(
      64,
      Math.max(0, Number(process.env.MINECRAFT_DAILY_LOGIN_EMERALDS ?? 12) || 0),
    ),
    starterKit: String(process.env.MINECRAFT_STARTER_KIT ?? '1') !== '0',
    timeZone: envString('MINECRAFT_TZ'),
    dataDir: envString('MINECRAFT_DATA_DIR') || serverRoot,
    worldPath: envString('MINECRAFT_WORLD_PATH') || (serverRoot ? path.join(serverRoot, 'world') : undefined),
    statsPath: envString('MINECRAFT_STATS_PATH') || (serverRoot ? path.join(serverRoot, 'tg-bot-stats.json') : undefined),
    usercachePath: envString('MINECRAFT_USERCACHE_PATH') || (serverRoot ? path.join(serverRoot, 'usercache.json') : undefined),
  },
};

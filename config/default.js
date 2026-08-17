import fs from 'fs';
import path from 'node:path';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const logPath = process.env.MINECRAFT_LOG_PATH || '/minecraft-data/logs/latest.log';
const serverRoot = path.dirname(path.dirname(logPath));

export default {
  application: {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
  },
  bot: {
    apiToken: process.env.MINECRAFT_TG_BOT_API_TOKEN,
  },
  telegramBotApi: {
    protocol: process.env.TELEGRAM_BOT_API_PROTOCOL || 'http:',
    host: process.env.TELEGRAM_BOT_API_HOST,
    port: process.env.TELEGRAM_BOT_API_PORT,
  },
  rcon: {
    host: process.env.MINECRAFT_RCON_HOST || 'minecraft',
    port: Number(process.env.MINECRAFT_RCON_PORT || 25575),
    password: process.env.MINECRAFT_RCON_PASSWORD || 'local-only',
    timeoutMs: Number(process.env.MINECRAFT_RCON_TIMEOUT_MS || 5000),
  },
  server: {
    motd: process.env.MINECRAFT_MOTD || 'artur-petrov SMP',
    address: process.env.MINECRAFT_ADDRESS || 'artur-petrov.vinnica.ua:25565',
    pollIntervalMs: Number(process.env.MINECRAFT_POLL_INTERVAL_MS || 5000),
    logPath,
    logPollMs: Number(process.env.MINECRAFT_LOG_POLL_MS || 1000),
    weatherPollMs: Number(process.env.MINECRAFT_WEATHER_POLL_MS || 30000),
    digestIntervalMs: Number(process.env.MINECRAFT_DIGEST_INTERVAL_MS || 3600000),
    tpsPollMs: Number(process.env.MINECRAFT_TPS_POLL_MS || 15000),
    tpsAlertBelow: Number(process.env.MINECRAFT_TPS_ALERT_BELOW || 15),
    tpsRecoverAt: Number(process.env.MINECRAFT_TPS_RECOVER_AT || 18),
    moonPollMs: Number(process.env.MINECRAFT_MOON_POLL_MS || 30000),
    emptyWorldMs: Number(process.env.MINECRAFT_EMPTY_WORLD_MS || 3 * 60 * 60 * 1000),
    dailyRecapHour: Number(process.env.MINECRAFT_DAILY_RECAP_HOUR || 21),
    weeklyRecapWeekday: Number(process.env.MINECRAFT_WEEKLY_RECAP_WEEKDAY || 0),
    recapPollMs: Number(process.env.MINECRAFT_RECAP_POLL_MS || 30000),
    timeZone: process.env.MINECRAFT_TZ || 'Europe/Kyiv',
    statsPath: process.env.MINECRAFT_STATS_PATH || path.join(serverRoot, 'tg-bot-stats.json'),
    usercachePath: process.env.MINECRAFT_USERCACHE_PATH || path.join(serverRoot, 'usercache.json'),
  },
};

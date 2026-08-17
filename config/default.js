import fs from 'fs';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

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
    logPath: process.env.MINECRAFT_LOG_PATH || '/minecraft-data/logs/latest.log',
    logPollMs: Number(process.env.MINECRAFT_LOG_POLL_MS || 1000),
    weatherPollMs: Number(process.env.MINECRAFT_WEATHER_POLL_MS || 30000),
    digestIntervalMs: Number(process.env.MINECRAFT_DIGEST_INTERVAL_MS || 3600000),
  },
};

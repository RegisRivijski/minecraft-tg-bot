# Minecraft Telegram Bot

Telegram bot for the **artur-petrov** SMP. DMs are the operator console. A forum group gets the live world feed: server events, two-way chat, and a pinned live status.

## Features

- DMs are available only to `OWNER_IDS`. Everyone else is ignored
- World status in DMs: players, time of day, difficulty, TPS, `minecraft-data` size, last world save
- Joins, leaves, deaths, advancements, music plays (`/music`), TPS, recaps, and other events go to the **server events** topic (**Події з серверу**)
- Starter kit on EasyAuth **register** (bed, iron tools, food, wood, torches, 8 emeralds). Daily kit on **login** (and on that first register): weekday loot plus streak extras at 3 and every 7 days. Set `MINECRAFT_STARTER_KIT=0` or `MINECRAFT_DAILY_LOGIN_EMERALDS=0` to turn either off. Enable EasyAuth `log-player-login` / `log-player-registration` or the bot never sees the lines.
- In-game chat is mirrored to the **server chat** topic (**Чат з сервером**); messages from that topic go into the world (`Name: text`)
- The General topic (**Головний чат**) is ignored: the bot does not read or write there
- A pinned live status message in the status topic: weather, moon, time, players
- Operator commands: time, weather, whitelist, `/say`, raw RCON

## Structure

Thin entrypoint; logic lives in `app/`.

```
index.js                 # start: import app from './app/index.js'
app/
  index.js               # bootstrap Telegraf, RCON, watchers
  routes/                # bind bot commands to controllers
  controllers/           # command handlers
    mainController.js    # /start, /help
    serverController.js  # /server, /list
    worldController.js   # /time, /weather, /seed, /difficulty
    adminController.js   # /say, /whitelist, /rcon
  helpers/               # business logic, forum feed, copy
  middlewares/           # ACL and error handling
  classes/
    ServiceSingletons/   # RCON connection
  constants/             # OWNER_IDS, GROUP_ID, TOPIC_THREADS
config/
  default.js             # config from environment variables
```

How to read the code:

1. A Telegram command arrives → `app/routes/index.js`
2. The route calls a function in `controllers/`
3. The controller reads data from `helpers/` and RCON, replies with copy from `copyHelper.js`
4. Background jobs (players, log, status board) start in `app/index.js`

Owner and forum group are set in `app/constants/access.js`.

## Installation

1. Clone the repository:

```bash
git clone https://github.com/RegisRivijski/minecraft-tg-bot.git
cd minecraft-tg-bot
```

2. Install dependencies:

```bash
npm install
```

3. Fill in `OWNER_IDS` and `GROUP_ID` in `app/constants/access.js`.
   Your id — send `/start` to the bot in DMs (it replies if your id is already in `OWNER_IDS`).
   Group id — add the bot as admin; logs will show `bot is administrator in supergroup -100…`.
   Topic ids — copy a topic link (`t.me/c/<chat>/<thread>`) into `TOPIC_THREADS`.
   For the bot to see regular group messages, disable privacy mode in BotFather (`/setprivacy` → Disable) or make the bot a group admin.

4. Set environment variables (Docker, systemd, or the shell). This project does not load a `.env` file.

Required: bot token, RCON host/port/password, MOTD, server address, log path, timezone. There are no in-code fallbacks for those.

```dotenv
MINECRAFT_TG_BOT_API_TOKEN=your_telegram_bot_token

MINECRAFT_RCON_HOST=127.0.0.1
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=your_rcon_password
MINECRAFT_RCON_TIMEOUT_MS=5000

MINECRAFT_MOTD=My SMP
MINECRAFT_ADDRESS=play.example.com:25565
MINECRAFT_TZ=Europe/Kyiv
MINECRAFT_POLL_INTERVAL_MS=5000
MINECRAFT_LOG_PATH=/minecraft-data/logs/latest.log
MINECRAFT_LOG_POLL_MS=1000
MINECRAFT_STATUS_BOARD_POLL_MS=15000
MINECRAFT_TPS_POLL_MS=30000
MINECRAFT_DAILY_LOGIN_EMERALDS=12
MINECRAFT_STARTER_KIT=1

TELEGRAM_BOT_API_PROTOCOL=http:
TELEGRAM_BOT_API_HOST=127.0.0.1
TELEGRAM_BOT_API_PORT=8081
```

`TELEGRAM_BOT_API_*` are only needed if the bot talks to a local [Telegram Bot API](https://github.com/tdlib/telegram-bot-api) instead of `api.telegram.org`.

5. Start the bot:

```bash
npm start
```

For development: `npm run dev` (node --watch). Parser tests: `npm test`.

With Docker, pass the same variables into the container; `Dockerfile` runs `npm start`.

## Commands

Commands work only in DMs with the owner.

| Command | Description |
| --- | --- |
| `/start` | Greeting and server address |
| `/help` | Command list |
| `/server` | World status, disk, last save |
| `/list` | Players online |
| `/time` | Time of day |
| `/time day\|night\|noon\|midnight` | Set time |
| `/seed` | World seed |
| `/difficulty` | Difficulty |
| `/difficulty peaceful\|easy\|normal\|hard` | Set difficulty |
| `/say <text>` | Message to in-game chat |
| `/weather` | Current weather |
| `/weather clear\|rain\|thunder` | Set weather |
| `/whitelist add\|remove\|list <nick>` | Whitelist |
| `/rcon <command>` | Raw console command |

## Technologies Used

- Node.js — runtime
- Telegraf — Telegram bot
- rcon-client — Minecraft server commands

## Contribution

Contributions are welcome! Please feel free to open issues or submit pull requests.

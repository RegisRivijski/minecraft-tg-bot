# Minecraft Telegram Bot

Telegram-бот для SMP-сервера **artur-petrov**. В личке — консоль оператора. В канал пишет ленту мира: вход и выход, чат, смерти, достижения, смену погоды и снимок онлайна раз в час.

## Features

- Личка доступна только владельцу из `OWNER_IDS`. Остальным бот не отвечает
- Статус мира в личке: игроки, время суток, сложность, TPS
- Лента в один канал из `CHANNEL_ID`: join/leave, чат мира, смерти, достижения
- Смена погоды в канал
- Раз в час — кто онлайн, если на сервере есть игроки
- Команды оператора: время, погода, whitelist, `/say`, произвольный RCON

## Структура

Точка входа тонкая, логика лежит в `app/`.

```
index.js                 # запуск: import app from './app/index.js'
app/
  index.js               # bootstrap Telegraf, RCON, вотчеры
  routes/                # привязка команд бота к контроллерам
  controllers/           # обработчики команд
    mainController.js    # /start, /help
    serverController.js  # /server, /list
    worldController.js   # /time, /weather, /seed, /difficulty
    adminController.js   # /say, /whitelist, /rcon
  helpers/               # бизнес-логика, лента канала, тексты
  middlewares/           # ACL и обработка ошибок
  classes/
    ServiceSingletons/   # подключение RCON
  constants/             # OWNER_IDS, CHANNEL_ID
config/
  default.js             # конфиг из переменных окружения
```

Как читать код:

1. Команда пришла в Telegram → `app/routes/index.js`
2. Роут вызывает функцию из `controllers/`
3. Контроллер берёт данные из `helpers/` и RCON, отвечает текстом из `copyHelper.js`
4. Фоновые задачи (игроки, лог, погода, дайджест) стартуют в `app/index.js`

Владелец и канал прописываются в `app/constants/access.js`.

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

3. Заполни `OWNER_IDS` и `CHANNEL_ID` в `app/constants/access.js`.
   Свой id — напиши боту `/start` в личке (если id уже в `OWNER_IDS`, бот ответит).
   Id канала — добавь бота в канал админом с правом публиковать сообщения; в логах появится `bot is administrator in channel -100…`.

4. Задай переменные окружения (процесс запуска: Docker, systemd, оболочка). Проект не читает `.env`.

```dotenv
MINECRAFT_TG_BOT_API_TOKEN=your_telegram_bot_token

MINECRAFT_RCON_HOST=minecraft
MINECRAFT_RCON_PORT=25575
MINECRAFT_RCON_PASSWORD=your_rcon_password
MINECRAFT_RCON_TIMEOUT_MS=5000

MINECRAFT_MOTD=artur-petrov SMP
MINECRAFT_ADDRESS=artur-petrov.vinnica.ua:25565
MINECRAFT_POLL_INTERVAL_MS=5000
MINECRAFT_LOG_PATH=/minecraft-data/logs/latest.log
MINECRAFT_LOG_POLL_MS=1000
MINECRAFT_WEATHER_POLL_MS=30000
MINECRAFT_DIGEST_INTERVAL_MS=3600000

TELEGRAM_BOT_API_PROTOCOL=http:
TELEGRAM_BOT_API_HOST=127.0.0.1
TELEGRAM_BOT_API_PORT=8081
```

`TELEGRAM_BOT_API_*` нужны только если бот ходит на локальный [Telegram Bot API](https://github.com/tdlib/telegram-bot-api), а не на `api.telegram.org`.

5. Start the bot:

```bash
npm start
```

Для разработки: `npm run dev` (node --watch).

Через Docker переменные передаются в контейнер, `Dockerfile` стартует `npm start`.

## Commands

Команды работают только в личке с владельцем.

| Команда | Описание |
| --- | --- |
| `/start` | Приветствие и адрес сервера |
| `/help` | Список команд |
| `/server` | Статус мира |
| `/list` | Игроки на сервере |
| `/time` | Время суток |
| `/time day\|night\|noon\|midnight` | Установить время |
| `/seed` | Зерно мира |
| `/difficulty` | Сложность |
| `/difficulty peaceful\|easy\|normal\|hard` | Установить сложность |
| `/say <текст>` | Сообщение в чат мира |
| `/weather` | Текущая погода |
| `/weather clear\|rain\|thunder` | Установить погоду |
| `/whitelist add\|remove\|list <ник>` | Вайтлист |
| `/rcon <команда>` | Произвольная консольная команда |

## Technologies Used

- Node.js — runtime
- Telegraf — Telegram-бот
- rcon-client — команды Minecraft-сервера

## Contribution

Contributions are welcome! Please feel free to open issues or submit pull requests.

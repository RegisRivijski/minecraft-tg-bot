# Minecraft Telegram Bot

Telegram-бот для SMP-сервера **artur-petrov**. Через RCON показывает статус мира, пишет о входе и выходе игроков, ретранслирует игровой чат в Telegram и даёт операторам команды управления сервером.

## Features

- Статус мира: игроки онлайн, время суток, сложность, TPS
- Уведомления о join / leave в разрешённые чаты
- Ретрансляция чата Minecraft → Telegram (`/chat on|off`)
- Вход и выход игроков в выбранный чат (`/joins on|off`)
- Смерти и достижения (`/events on|off`)
- Команды оператора: время, погода, whitelist, `say`, произвольный RCON
- ACL: только указанные user id и group chat id

## Структура

Та же схема, что в gacha-simulator-rest: точка входа тонкая, логика лежит в `app/`.

```
index.js                 # запуск: import app from './app/index.js'
app/
  index.js               # bootstrap Telegraf, Mongo, RCON, вотчеры
  routes/                # привязка команд бота к контроллерам
  controllers/           # обработчики команд (как HTTP-контроллеры в REST)
    mainController.js    # /start, /help
    serverController.js  # /server, /list
    worldController.js   # /time, /weather, /seed, /difficulty
    chatController.js    # /chat, /joins, /events
    adminController.js   # /say, /whitelist, /rcon
  helpers/               # бизнес-логика и тексты ответов
  middlewares/           # ACL и обработка ошибок
  classes/
    MongooseSignletons/  # подключение MongoDB
    ServiceSingletons/   # подключение RCON
  models/
    minecraftTgBot/      # mongoose-модели (папка = имя базы)
  constants/             # OWNER_IDS, CHAT_IDS
config/
  default.js             # конфиг из переменных окружения
```

Как читать код:

1. Команда пришла в Telegram → `app/routes/index.js`
2. Роут вызывает функцию из `controllers/`
3. Контроллер берёт данные из `helpers/` и синглтонов, отвечает текстом из `copyHelper.js`
4. Фоновые задачи (игроки, лог чата) стартуют в `app/index.js`

Доступ прописывается вручную в `app/constants/access.js`.

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

3. Заполни `OWNER_IDS` и `CHAT_IDS` в `app/constants/access.js`. Свой id можно узнать, написав боту `/start` в личке.

4. Задай переменные окружения (процесс запуска: Docker, systemd, оболонка). Проект не читает `.env`.

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

MONGODB_1_HOSTNAME=your_mongodb_url
MONGO_INITDB_ROOT_USERNAME=your_mongo_username
MONGO_INITDB_ROOT_PASSWORD=your_mongo_password

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

| Команда | Кто | Описание |
| --- | --- | --- |
| `/start` | все | Приветствие и адрес сервера |
| `/help` | все | Список команд |
| `/server` | все | Меню мира |
| `/list`, `/online` | все | Игроки на сервере |
| `/time` | все | Время суток |
| `/time day\|night\|noon\|midnight` | оператор | Установить время |
| `/seed` | все | Зерно мира |
| `/difficulty` | все | Сложность |
| `/difficulty peaceful\|easy\|normal\|hard` | оператор | Установить сложность |
| `/chat on\|off` | все | Ретрансляция чата мира в этот Telegram-чат |
| `/joins on\|off` | все | Вход и выход игроков в этот Telegram-чат |
| `/events on\|off` | все | Смерти и достижения в этот Telegram-чат |
| `/weather clear\|rain\|thunder` | оператор | Погода |
| `/say <текст>` | оператор | Сообщение в чат мира |
| `/whitelist add\|remove\|list <ник>` | оператор | Вайтлист |
| `/rcon <команда>` | оператор | Произвольная консольная команда |

## Technologies Used

- Node.js — runtime
- Telegraf — Telegram-бот
- MongoDB / Mongoose — настройки ретрансляции чата
- rcon-client — команды Minecraft-сервера

## Contribution

Contributions are welcome! Please feel free to open issues or submit pull requests.

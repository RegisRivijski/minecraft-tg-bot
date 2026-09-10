/**
 * OWNER_IDS — Telegram user ids. Only these people can use the bot in DMs
 * and run operator commands.
 *
 * GROUP_ID — forum group with topics. The bot posts there and reads the
 * chat topic. It must be a group admin (or privacy mode must be disabled
 * in BotFather: /setprivacy → Disable). After changing privacy, remove
 * the bot from the group and add it again.
 *
 * TOPIC_THREADS — message_thread_id of each topic, from a topic link
 * t.me/c/<chat>/<thread> or t.me/c/<chat>/<thread>/<msg>.
 * The General topic ("Головний чат") is not used for the world feed.
 * Group members can manage the whitelist there with /whitelist.
 *
 * To get a group id, add the bot — logs will show
 * `[forum] bot is administrator in supergroup -100…`.
 * Your own id: send /start to the bot in DMs.
 */
export const OWNER_IDS = [
  755610236,
];

export const GROUP_ID = -1004330943744;

export const TOPIC_THREADS = {
  events: 227, // Події з серверу — https://t.me/c/4330943744/227
  chat: 229, // Чат з сервером — https://t.me/c/4330943744/229
  status: 2512, // Живая сводка — https://t.me/c/4330943744/2512
};

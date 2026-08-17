/**
 * OWNER_IDS — Telegram user ids. Only these people can use the bot in DMs
 * and run operator commands.
 *
 * CHANNEL_ID — channel that receives the world feed: join/leave, in-game chat,
 * deaths, advancements, weather changes, and an hourly online snapshot
 * (when anyone is on the server). The bot must be a channel admin
 * with permission to post messages.
 *
 * CHAT_ID — group whose messages are forwarded into Minecraft chat
 * (`Name: text`). The bot must see group messages: make it a group admin
 * or disable privacy mode in BotFather (/setprivacy → Disable).
 *
 * To get an id, add the bot to the channel/group — logs will show
 * `[channel] bot is administrator in channel|supergroup -100…`.
 * Your own id: send /start to the bot in DMs.
 */
export const OWNER_IDS = [
  755610236,
];

export const CHANNEL_ID = -1003751386514;

export const CHAT_ID = 0;

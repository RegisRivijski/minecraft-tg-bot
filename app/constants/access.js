/**
 * OWNER_IDS — telegram user id операторов. Только они могут менять мир.
 * CHAT_IDS — групповые чаты, где бот отвечает на команды (просмотр).
 *
 * Узнать id: напиши боту /start в личке или в группе.
 */
export const OWNER_IDS = [
  755610236,
];

export const CHAT_IDS = [
  // -1001234567890,
];

export function isOwner(userId) {
  return OWNER_IDS.includes(Number(userId));
}

export function isAllowedChat(chatId) {
  return CHAT_IDS.includes(Number(chatId));
}

export function canUseBot(ctx) {
  if (isAllowedChat(ctx.chat?.id)) {
    return true;
  }
  return ctx.chat?.type === 'private' && isOwner(ctx.from?.id);
}

export function isOwnerCtx(ctx) {
  return isOwner(ctx.from?.id);
}

export function notifyChatIds() {
  if (CHAT_IDS.length) {
    return CHAT_IDS;
  }
  return OWNER_IDS;
}

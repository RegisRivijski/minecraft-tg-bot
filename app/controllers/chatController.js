import {
  isChatRelayEnabled,
  isJoinRelayEnabled,
  setChatRelay,
  setJoinRelay,
} from '../helpers/chatRelayHelper.js';
import {
  HTML,
  chatStatus,
  chatUsage,
  joinsStatus,
  joinsUsage,
} from '../helpers/copyHelper.js';
import { commandArgs } from '../helpers/minecraftHelper.js';

function parseToggle(args) {
  if (['on', 'вкл', 'enable'].includes(args)) {
    return true;
  }
  if (['off', 'выкл', 'disable'].includes(args)) {
    return false;
  }
  return null;
}

export async function chat(ctx) {
  const args = commandArgs(ctx).toLowerCase();
  if (!args) {
    await ctx.reply(chatStatus(isChatRelayEnabled(ctx.chat.id)), HTML);
    return;
  }
  const on = parseToggle(args);
  if (on == null) {
    await ctx.reply(chatUsage(), HTML);
    return;
  }
  await setChatRelay(ctx.chat.id, on, ctx.chat.title);
  await ctx.reply(chatStatus(on), HTML);
}

export async function joins(ctx) {
  const args = commandArgs(ctx).toLowerCase();
  if (!args) {
    await ctx.reply(joinsStatus(isJoinRelayEnabled(ctx.chat.id)), HTML);
    return;
  }
  const on = parseToggle(args);
  if (on == null) {
    await ctx.reply(joinsUsage(), HTML);
    return;
  }
  await setJoinRelay(ctx.chat.id, on, ctx.chat.title);
  await ctx.reply(joinsStatus(on), HTML);
}

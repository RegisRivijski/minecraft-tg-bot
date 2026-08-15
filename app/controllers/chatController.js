import {
  isChatRelayEnabled,
  isEventRelayEnabled,
  isJoinRelayEnabled,
  setChatRelay,
  setEventRelay,
  setJoinRelay,
} from '../helpers/chatRelayHelper.js';
import {
  HTML,
  chatStatus,
  chatUsage,
  eventsStatus,
  eventsUsage,
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

async function handleToggle(ctx, {
  isEnabled, setEnabled, status, usage,
}) {
  const args = commandArgs(ctx).toLowerCase();
  if (!args) {
    await ctx.reply(status(isEnabled(ctx.chat.id)), HTML);
    return;
  }
  const on = parseToggle(args);
  if (on == null) {
    await ctx.reply(usage(), HTML);
    return;
  }
  await setEnabled(ctx.chat.id, on, ctx.chat.title);
  await ctx.reply(status(on), HTML);
}

export function chat(ctx) {
  return handleToggle(ctx, {
    isEnabled: isChatRelayEnabled,
    setEnabled: setChatRelay,
    status: chatStatus,
    usage: chatUsage,
  });
}

export function joins(ctx) {
  return handleToggle(ctx, {
    isEnabled: isJoinRelayEnabled,
    setEnabled: setJoinRelay,
    status: joinsStatus,
    usage: joinsUsage,
  });
}

export function events(ctx) {
  return handleToggle(ctx, {
    isEnabled: isEventRelayEnabled,
    setEnabled: setEventRelay,
    status: eventsStatus,
    usage: eventsUsage,
  });
}

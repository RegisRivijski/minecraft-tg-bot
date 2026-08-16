import {
  isAdvancementRelayEnabled,
  isChatRelayEnabled,
  isDeathRelayEnabled,
  isJoinRelayEnabled,
  setAdvancementRelay,
  setChatRelay,
  setDeathRelay,
  setJoinRelay,
} from '../helpers/chatRelayHelper.js';
import {
  HTML,
  advancementsStatus,
  advancementsUsage,
  chatStatus,
  chatUsage,
  deathsStatus,
  deathsUsage,
  eventsSplitHint,
  joinsStatus,
  joinsUsage,
} from '../helpers/copyHelper.js';
import { commandArgs } from '../helpers/minecraftHelper.js';

function parseToggle(arg) {
  if (['on', 'вкл', 'enable'].includes(arg)) {
    return true;
  }
  if (['off', 'выкл', 'disable'].includes(arg)) {
    return false;
  }
  return null;
}

async function handleToggle(ctx, {
  isEnabled, setEnabled, status, usage,
}) {
  const arg = commandArgs(ctx).toLowerCase();
  if (!arg) {
    await ctx.reply(status(isEnabled(ctx.chat.id)), HTML);
    return;
  }

  const enabled = parseToggle(arg);
  if (enabled == null) {
    await ctx.reply(usage(), HTML);
    return;
  }

  await setEnabled(ctx.chat.id, enabled, ctx.chat.title);
  await ctx.reply(status(enabled), HTML);
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

export function deaths(ctx) {
  return handleToggle(ctx, {
    isEnabled: isDeathRelayEnabled,
    setEnabled: setDeathRelay,
    status: deathsStatus,
    usage: deathsUsage,
  });
}

export function advancements(ctx) {
  return handleToggle(ctx, {
    isEnabled: isAdvancementRelayEnabled,
    setEnabled: setAdvancementRelay,
    status: advancementsStatus,
    usage: advancementsUsage,
  });
}

export async function events(ctx) {
  const arg = commandArgs(ctx).toLowerCase();
  const chatId = ctx.chat.id;

  if (!arg) {
    await ctx.reply([
      deathsStatus(isDeathRelayEnabled(chatId)),
      advancementsStatus(isAdvancementRelayEnabled(chatId)),
      '',
      eventsSplitHint(),
    ].join('\n'), HTML);
    return;
  }

  const enabled = parseToggle(arg);
  if (enabled == null) {
    await ctx.reply(eventsSplitHint(), HTML);
    return;
  }

  await setDeathRelay(chatId, enabled, ctx.chat.title);
  await setAdvancementRelay(chatId, enabled, ctx.chat.title);
  await ctx.reply([
    deathsStatus(enabled),
    advancementsStatus(enabled),
  ].join('\n'), HTML);
}

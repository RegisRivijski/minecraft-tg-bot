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
  const args = commandArgs(ctx).toLowerCase();
  const chatId = ctx.chat.id;
  if (!args) {
    await ctx.reply([
      deathsStatus(isDeathRelayEnabled(chatId)),
      advancementsStatus(isAdvancementRelayEnabled(chatId)),
      '',
      eventsSplitHint(),
    ].join('\n'), HTML);
    return;
  }
  const on = parseToggle(args);
  if (on == null) {
    await ctx.reply(eventsSplitHint(), HTML);
    return;
  }
  await setDeathRelay(chatId, on, ctx.chat.title);
  await setAdvancementRelay(chatId, on, ctx.chat.title);
  await ctx.reply([
    deathsStatus(on),
    advancementsStatus(on),
  ].join('\n'), HTML);
}

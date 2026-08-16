import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { requireOwner } from '../helpers/accessHelper.js';
import {
  HTML,
  rconEmpty,
  rconUsage,
  sayDone,
  sayUsage,
  whitelistUsage,
} from '../helpers/copyHelper.js';
import { commandArgs, escapeHtml, stripMcColor } from '../helpers/minecraftHelper.js';

const RCON_REPLY_LIMIT = 3500;

function speakerName(ctx) {
  const from = ctx.from || {};
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ')
    || from.username
    || String(from.id || 'Telegram');
  return String(name).replace(/[\r\n]+/g, ' ').trim();
}

function formatRconReply(raw) {
  const text = stripMcColor(raw);
  if (!text) {
    return null;
  }
  return `<pre>${escapeHtml(text).slice(0, RCON_REPLY_LIMIT)}</pre>`;
}

export async function say(ctx) {
  const text = commandArgs(ctx).replace(/[\r\n]+/g, ' ').trim();
  if (!text) {
    await ctx.reply(sayUsage(), HTML);
    return;
  }
  const name = speakerName(ctx);
  await rconSend(`say ${name}: ${text}`);
  await ctx.reply(sayDone(name), HTML);
}

export async function whitelist(ctx) {
  if (!(await requireOwner(ctx))) {
    return;
  }
  const args = commandArgs(ctx);
  if (!args) {
    await ctx.reply(whitelistUsage(), HTML);
    return;
  }
  const reply = formatRconReply(await rconSend(`whitelist ${args}`));
  await ctx.reply(reply || 'Команда выполнена.', HTML);
}

export async function rcon(ctx) {
  if (!(await requireOwner(ctx))) {
    return;
  }
  const command = commandArgs(ctx);
  if (!command) {
    await ctx.reply(rconUsage(), HTML);
    return;
  }
  const reply = formatRconReply(await rconSend(command));
  await ctx.reply(reply || rconEmpty(), HTML);
}

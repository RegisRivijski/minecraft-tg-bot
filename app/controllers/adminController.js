import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { requireOwner, requireWhitelistAccess } from '../helpers/accessHelper.js';
import {
  HTML,
  rconEmpty,
  rconUsage,
  sayDone,
  sayUsage,
  whitelistInvalidNicks,
  whitelistListText,
  whitelistUsage,
} from '../helpers/copyHelper.js';
import {
  commandArgs,
  escapeHtml,
  isMinecraftNick,
  parseWhitelistList,
  speakerName,
  stripMcColor,
} from '../helpers/minecraftHelper.js';

const RCON_REPLY_LIMIT = 3500;

function formatRconReply(raw) {
  const text = stripMcColor(raw);
  if (!text) {
    return null;
  }
  return `<pre>${escapeHtml(text).slice(0, RCON_REPLY_LIMIT)}</pre>`;
}

export async function say(ctx) {
  if (!(await requireOwner(ctx))) {
    return;
  }
  const text = commandArgs(ctx).replace(/[\r\n]+/g, ' ').trim();
  if (!text) {
    await ctx.reply(sayUsage(), HTML);
    return;
  }
  const name = speakerName(ctx);
  await rconSend(`say ${name}: ${text}`);
  await ctx.reply(sayDone(name), HTML);
}

function replyToCommand(ctx, extra = HTML) {
  const messageId = ctx.message?.message_id;
  if (!messageId) {
    return extra;
  }
  return { ...extra, reply_to_message_id: messageId };
}

function parseWhitelistArgs(args) {
  const parts = String(args || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return null;
  }
  const actionRaw = parts[0].toLowerCase();
  const action = ['del', 'rm', 'delete'].includes(actionRaw) ? 'remove' : actionRaw;
  if (!['add', 'remove', 'list'].includes(action)) {
    return null;
  }
  if (action === 'list') {
    return { action };
  }
  const names = [];
  const seen = new Set();
  const invalid = [];
  for (const name of parts.slice(1)) {
    if (!isMinecraftNick(name)) {
      invalid.push(name);
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return { action, names, invalid };
}

function actorLabel(ctx) {
  const from = ctx.from || {};
  return from.username ? `@${from.username}` : String(from.id || '?');
}

export async function whitelist(ctx) {
  if (!(await requireWhitelistAccess(ctx))) {
    return;
  }
  const parsed = parseWhitelistArgs(commandArgs(ctx));
  if (!parsed) {
    await ctx.reply(whitelistUsage(), replyToCommand(ctx));
    return;
  }

  if (parsed.action === 'list') {
    const data = parseWhitelistList(await rconSend('whitelist list'));
    await ctx.reply(whitelistListText(data), replyToCommand(ctx));
    return;
  }

  const lines = [];
  if (parsed.names.length) {
    for (const nick of parsed.names) {
      const raw = stripMcColor(await rconSend(`whitelist ${parsed.action} ${nick}`));
      lines.push(raw ? escapeHtml(raw) : escapeHtml(nick));
    }
    console.info(`[whitelist] ${actorLabel(ctx)} ${parsed.action} ${parsed.names.join(', ')}`);
  }
  if (parsed.invalid?.length) {
    if (lines.length) {
      lines.push('');
    }
    lines.push(whitelistInvalidNicks(parsed.invalid));
  }
  if (!parsed.names.length && parsed.invalid?.length) {
    await ctx.reply(lines.join('\n'), replyToCommand(ctx));
    return;
  }
  if (!parsed.names.length) {
    await ctx.reply(whitelistUsage(), replyToCommand(ctx));
    return;
  }

  const data = parseWhitelistList(await rconSend('whitelist list'));
  lines.push('', whitelistListText(data));
  await ctx.reply(lines.join('\n'), replyToCommand(ctx));
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

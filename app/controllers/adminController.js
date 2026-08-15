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

export async function say(ctx) {
  if (!(await requireOwner(ctx))) {
    return;
  }
  const text = commandArgs(ctx);
  if (!text) {
    await ctx.reply(sayUsage(), HTML);
    return;
  }
  await rconSend(`say ${text}`);
  await ctx.reply(sayDone(), HTML);
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
  const result = stripMcColor(await rconSend(`whitelist ${args}`));
  await ctx.reply(result ? `<pre>${escapeHtml(result).slice(0, 3500)}</pre>` : 'Команда выполнена.', HTML);
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
  const result = stripMcColor(await rconSend(command));
  await ctx.reply(result ? `<pre>${escapeHtml(result).slice(0, 3500)}</pre>` : rconEmpty(), HTML);
}

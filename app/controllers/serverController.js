import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { HTML, listText, serverMenu } from '../helpers/copyHelper.js';
import { parsePlayerList } from '../helpers/minecraftHelper.js';
import { fetchServer } from '../helpers/serverHelper.js';

export async function server(ctx) {
  await ctx.reply(serverMenu(await fetchServer()), HTML);
}

export async function list(ctx) {
  const players = parsePlayerList(await rconSend('list'));
  await ctx.reply(listText(players), HTML);
}

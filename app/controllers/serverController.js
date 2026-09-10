import { rconSend } from '../classes/ServiceSingletons/RconSingleton.js';
import { HTML, listText, serverMenu } from '../helpers/copyHelper.js';
import { parsePlayerList, PLAYER_LIST_COMMAND } from '../helpers/minecraftHelper.js';
import { fetchServer } from '../helpers/serverHelper.js';

export async function server(ctx) {
  const snapshot = await fetchServer();
  await ctx.reply(serverMenu(snapshot), HTML);
}

export async function list(ctx) {
  const players = parsePlayerList(await rconSend(PLAYER_LIST_COMMAND));
  await ctx.reply(listText(players), HTML);
}

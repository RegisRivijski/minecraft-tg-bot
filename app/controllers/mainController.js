import { HTML, helpText, startText } from '../helpers/copyHelper.js';

export async function start(ctx) {
  await ctx.reply(startText(), HTML);
}

export async function help(ctx) {
  await ctx.reply(helpText(), HTML);
}

export function onMyChatMember(ctx) {
  const chat = ctx.chat;
  const member = ctx.myChatMember?.new_chat_member;
  if (!chat || !member) {
    return;
  }
  const title = chat.title || chat.username || '';
  console.info(`[channel] bot is ${member.status} in ${chat.type} ${chat.id}${title ? ` «${title}»` : ''}`);
}

import { HTML, helpText, startText } from '../helpers/copyHelper.js';
import { getGroupChatId } from '../helpers/forumHelper.js';

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
  console.info(`[forum] bot is ${member.status} in ${chat.type} ${chat.id}${title ? ` «${title}»` : ''}`);
  if (['group', 'supergroup'].includes(chat.type) && ['member', 'administrator', 'creator'].includes(member.status)) {
    const expected = getGroupChatId();
    if (expected && Number(chat.id) === expected) {
      console.info('[forum] this is the configured group');
      return;
    }
    console.info(`[forum] to use this group, set GROUP_ID to ${chat.id}`);
  }
}

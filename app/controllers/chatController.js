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
import { isOwnerCtx } from '../helpers/accessHelper.js';
import {
  htmlMarkup,
  notifyNotAdmin,
  notifyPanelText,
  notifyToggleLabel,
} from '../helpers/copyHelper.js';

const TOGGLES = {
  chat: {
    isEnabled: isChatRelayEnabled,
    setEnabled: setChatRelay,
    hint: 'Чат мира',
  },
  joins: {
    isEnabled: isJoinRelayEnabled,
    setEnabled: setJoinRelay,
    hint: 'Вход и выход',
  },
  deaths: {
    isEnabled: isDeathRelayEnabled,
    setEnabled: setDeathRelay,
    hint: 'Смерти',
  },
  adv: {
    isEnabled: isAdvancementRelayEnabled,
    setEnabled: setAdvancementRelay,
    hint: 'Достижения',
  },
};

function chatTitle(ctx) {
  if (ctx.chat?.title) {
    return ctx.chat.title;
  }
  const from = ctx.from || {};
  return [from.first_name, from.last_name].filter(Boolean).join(' ');
}

function notifyKeyboard(chatId) {
  return Object.keys(TOGGLES).map((key) => ([
    {
      text: notifyToggleLabel(key, TOGGLES[key].isEnabled(chatId)),
      callback_data: `n:${key}`,
    },
  ]));
}

async function canManageNotify(ctx) {
  if (isOwnerCtx(ctx) || ctx.chat?.type === 'private') {
    return true;
  }
  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return ['creator', 'administrator'].includes(member.status);
  } catch {
    return false;
  }
}

async function showNotifyPanel(ctx) {
  await ctx.reply(
    notifyPanelText(ctx.chat),
    htmlMarkup(notifyKeyboard(ctx.chat.id)),
  );
}

export function notify(ctx) {
  return showNotifyPanel(ctx);
}

export async function onNotifyToggle(ctx) {
  const key = ctx.match?.[1];
  const toggle = TOGGLES[key];
  if (!toggle) {
    await ctx.answerCbQuery();
    return;
  }

  if (!(await canManageNotify(ctx))) {
    await ctx.answerCbQuery(notifyNotAdmin());
    return;
  }

  const chatId = ctx.chat.id;
  const enabled = !toggle.isEnabled(chatId);
  await toggle.setEnabled(chatId, enabled, chatTitle(ctx));

  try {
    await ctx.editMessageText(
      notifyPanelText(ctx.chat),
      htmlMarkup(notifyKeyboard(chatId)),
    );
  } catch (err) {
    if (!/message is not modified/i.test(err.message || '')) {
      throw err;
    }
  }
  await ctx.answerCbQuery(`${toggle.hint}: ${enabled ? 'вкл' : 'выкл'}`);
}

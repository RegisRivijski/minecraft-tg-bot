import { isOwner, isOwnerCtx, requireOwner } from '../helpers/accessHelper.js';
import {
  accessApprovedViewerText,
  accessDecisionDone,
  accessDeniedViewerText,
  accessGateText,
  accessRevokedViewerText,
  groupAccessGranted,
  HTML,
  htmlMarkup,
  viewersKeyboard,
  viewersListText,
} from '../helpers/copyHelper.js';
import {
  accessLabel,
  approveAccess,
  findAccess,
  listViewers,
  notifyTarget,
  profileFrom,
  revokeAccess,
  submitAccessRequest,
} from '../helpers/viewerHelper.js';

function viewerEntries(docs) {
  const rank = { pending: 0, approved: 1, revoked: 2 };
  return docs
    .map((doc) => ({
      chatId: doc.chatId,
      kind: doc.kind || (doc.chatId < 0 ? 'group' : 'private'),
      status: doc.status,
      label: accessLabel(doc),
    }))
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
}

async function showViewersList(ctx, { edit = false } = {}) {
  const entries = viewerEntries(await listViewers());
  const text = viewersListText(entries);
  const extra = entries.length ? htmlMarkup(viewersKeyboard(entries)) : HTML;
  if (edit) {
    try {
      await ctx.editMessageText(text, extra);
    } catch (err) {
      if (!/message is not modified/i.test(err.message || '')) {
        throw err;
      }
    }
    return;
  }
  await ctx.reply(text, extra);
}

function profileFields(doc) {
  return {
    kind: doc.kind,
    title: doc.title,
    username: doc.username,
    firstName: doc.firstName,
    lastName: doc.lastName,
  };
}

async function applyDecision(ctx, chatId, action) {
  const doc = await findAccess(chatId) || { chatId };
  const label = accessLabel(doc);

  if (action === 'ok' || action === 'on') {
    await approveAccess(chatId, ctx.from.id, profileFields(doc));
    await notifyTarget(ctx.telegram, chatId, accessApprovedViewerText(), HTML);
    return { approved: true, label };
  }

  await revokeAccess(chatId, ctx.from.id, profileFields(doc));
  const text = action === 'x' ? accessRevokedViewerText() : accessDeniedViewerText();
  await notifyTarget(ctx.telegram, chatId, text, HTML);
  return { approved: false, label };
}

function decisionToast(action, approved) {
  if (action === 'x') {
    return 'Отключено';
  }
  return approved ? 'Одобрено' : 'Отклонено';
}

export async function viewers(ctx) {
  if (!(await requireOwner(ctx))) {
    return;
  }
  await showViewersList(ctx);
}

export async function onRequestDecision(ctx) {
  if (!isOwnerCtx(ctx)) {
    await ctx.answerCbQuery('Только владелец');
    return;
  }

  const action = ctx.match?.[1];
  const chatId = Number(ctx.match?.[2]);
  if (!action || !Number.isFinite(chatId)) {
    await ctx.answerCbQuery();
    return;
  }

  const result = await applyDecision(ctx, chatId, action);
  await ctx.editMessageText(accessDecisionDone(result), HTML).catch(() => {});
  await ctx.answerCbQuery(decisionToast(action, result.approved));
}

export async function onViewerAction(ctx) {
  if (!isOwnerCtx(ctx)) {
    await ctx.answerCbQuery('Только владелец');
    return;
  }

  const action = ctx.match?.[1];
  const chatId = Number(ctx.match?.[2]);
  if (!action || !Number.isFinite(chatId)) {
    await ctx.answerCbQuery();
    return;
  }

  const result = await applyDecision(ctx, chatId, action);
  await showViewersList(ctx, { edit: true });
  await ctx.answerCbQuery(decisionToast(action, result.approved));
}

export async function onMyChatMember(ctx) {
  const chat = ctx.chat;
  const status = ctx.myChatMember?.new_chat_member?.status;
  if (!chat || chat.type === 'private') {
    return;
  }

  if (status === 'kicked' || status === 'left') {
    if (!isOwner(chat.id)) {
      await revokeAccess(chat.id, ctx.from?.id, profileFrom(chat, ctx.from));
    }
    return;
  }

  if (!['member', 'administrator'].includes(status)) {
    return;
  }

  if (isOwnerCtx(ctx)) {
    await approveAccess(chat.id, ctx.from.id, profileFrom(chat, ctx.from));
    await ctx.telegram.sendMessage(chat.id, groupAccessGranted(), HTML).catch(() => {});
    return;
  }

  const result = await submitAccessRequest(ctx);
  if (result.status === 'requested') {
    await ctx.telegram.sendMessage(chat.id, accessGateText(result.status), HTML).catch(() => {});
  }
}

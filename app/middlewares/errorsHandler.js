import { connectionLost, unknownError } from '../helpers/copyHelper.js';

function isConnectionError(err) {
  const message = err.message || '';
  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|timeout|not connected/i.test(message);
}

export default async function errorsHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    const text = isConnectionError(err) ? connectionLost() : unknownError();
    console.error('[bot]', err.message || err);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(text.slice(0, 200)).catch(() => {});
    }

    await ctx.reply(text).catch(() => {});
  }
}

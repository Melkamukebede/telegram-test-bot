import { InlineKeyboard } from "grammy";
import { isPrivate } from "../auth.js";

function commandName(ctx) {
  const t = ctx.message?.text;
  if (!t || !t.startsWith("/")) return null;
  return t.slice(1).split(/[\s@]/)[0].toLowerCase();
}

function withClearButton(replyMarkup, messageId) {
  const clearRow = [{ text: "🧹 Clear", callback_data: `clear_${messageId}` }];

  if (!replyMarkup) return { inline_keyboard: [clearRow] };
  if (!replyMarkup.inline_keyboard) return replyMarkup;

  return {
    ...replyMarkup,
    inline_keyboard: [...replyMarkup.inline_keyboard, clearRow],
  };
}

export function registerCleanup(bot) {
  // Runs before every other handler and adds Clear to private-chat replies.
  bot.use(async (ctx, next) => {
    if (!isPrivate(ctx) || !ctx.message) return next();

    const messageId = ctx.message.message_id;
    const original = ctx.reply.bind(ctx);
    ctx.reply = (text, other = {}) =>
      original(text, {
        ...other,
        reply_markup: withClearButton(other.reply_markup, messageId),
      });

    return next();
  });

  bot.callbackQuery(/^clear_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Cleared" });
    if (!isPrivate(ctx)) return;

    const del = async (id) => {
      try { await ctx.api.deleteMessage(ctx.chat.id, id); } catch {} // too old or already gone: ignore
    };
    await del(Number(ctx.match[1]));
    const replyId = ctx.callbackQuery.message?.message_id;
    if (replyId) await del(replyId);
  });
}

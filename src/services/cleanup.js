import { InlineKeyboard } from "grammy";
import { isPrivate, roleOf } from "../auth.js";
import { ADMIN_COMMANDS, OWNER_COMMANDS } from "../commandLists.js";

const ADMIN_NAMES = new Set([...ADMIN_COMMANDS, ...OWNER_COMMANDS].map((c) => c.command));

function commandName(ctx) {
  const t = ctx.message?.text;
  if (!t || !t.startsWith("/")) return null;
  return t.slice(1).split(/[\s@]/)[0].toLowerCase();
}

export function registerCleanup(bot, env) {
  // Runs before every other handler
  bot.use(async (ctx, next) => {
    if (!isPrivate(ctx) || !ctx.message) return next();

    const isAdminCommand = ADMIN_NAMES.has(commandName(ctx) ?? "");
    const isFile = !!ctx.message.document;
    if (!isAdminCommand && !isFile) return next();

    // Students never get a Clear button
    if ((await roleOf(ctx, env)) === "student") return next();

    const commandMessageId = ctx.message.message_id;
    const original = ctx.reply.bind(ctx);
    ctx.reply = (text, other = {}) =>
      original(text, {
        ...other,
        reply_markup: other.reply_markup ?? new InlineKeyboard().text("🧹 Clear", `clear_${commandMessageId}`),
      });
    return next();
  });

  bot.callbackQuery(/^clear_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Cleared" });
    if (!isPrivate(ctx)) return;

    const del = async (id) => {
      try { await ctx.api.deleteMessage(ctx.chat.id, id); } catch {} // too old or already gone: ignore
    };
    await del(Number(ctx.match[1]));                       // the admin's command or file
    const replyId = ctx.callbackQuery.message?.message_id;
    if (replyId) await del(replyId);                        // this bot reply
  });
}

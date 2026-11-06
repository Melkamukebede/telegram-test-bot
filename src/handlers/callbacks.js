import { InlineKeyboard } from "grammy";
import { getUser, getSubject, startRegistration } from "../db.js";
import { questionText, todayAddis } from "../config.js";
import { mainMenuScreen, infoScreen, subjectsScreen, helpScreen } from "../screens.js";
import { postLeaderboard } from "../services/scheduler.js";

// Edit the message in place; ignore Telegram's "message is not modified" error
async function show(ctx, text, keyboard) {
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } catch (e) {
    if (!String(e.message).includes("message is not modified")) throw e;
  }
}

export function registerCallbacks(bot, env) {
  bot.callbackQuery("main_menu", async (ctx) => {
    const { text, keyboard } = mainMenuScreen();
    await ctx.answerCallbackQuery();
    await show(ctx, text, keyboard);
  });

  bot.callbackQuery("screen_info", async (ctx) => {
    const { text, keyboard } = await infoScreen(env, String(ctx.from.id));
    await ctx.answerCallbackQuery();
    await show(ctx, text, keyboard);
  });

  bot.callbackQuery("screen_subjects", async (ctx) => {
    const { text, keyboard } = await subjectsScreen(env);
    await ctx.answerCallbackQuery();
    await show(ctx, text, keyboard);
  });

  bot.callbackQuery("screen_help", async (ctx) => {
    const { text, keyboard } = helpScreen();
    await ctx.answerCallbackQuery();
    await show(ctx, text, keyboard);
  });

  bot.callbackQuery("show_leaderboard", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Leaderboard posted to the group." });
    await postLeaderboard(env, bot.api);
  });

  bot.callbackQuery("start_register", async (ctx) => {
    await startRegistration(env, String(ctx.from.id));
    await ctx.answerCallbackQuery();
    await show(ctx, questionText(0), new InlineKeyboard().text("⬅ Back", "main_menu"));
  });

  bot.callbackQuery(/^subject_(.+)$/, async (ctx) => {
    const subject = await getSubject(env, ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!subject) { await show(ctx, "That subject wasn't found.", new InlineKeyboard().text("⬅ Back", "screen_subjects")); return; }
    await show(
      ctx,
      `📖 ${subject.display_name}\n\n${subject.drive_link}`,
      new InlineKeyboard().text("⬅ Back", "screen_subjects")
    );
  });

  // A / B / C / D buttons under a posted question
  bot.callbackQuery(/^answer_(\d+)_([1-4])$/, async (ctx) => {
    const questionId = Number(ctx.match[1]);
    const selected = Number(ctx.match[2]);
    const telegramId = String(ctx.from.id);

    const user = await getUser(env, telegramId);
    if (!user || !user.university) {
      await ctx.answerCallbackQuery({ text: "Register first: DM the bot and send /register", show_alert: true });
      return;
    }

    const q = await env.DB.prepare(
      "SELECT correct_option, is_revealed FROM daily_questions WHERE id = ? AND is_posted = 1"
    ).bind(questionId).first();
    if (!q) { await ctx.answerCallbackQuery({ text: "This question is no longer available." }); return; }
    if (q.is_revealed) { await ctx.answerCallbackQuery({ text: "This question is closed. The answer was already revealed." }); return; }

    const isCorrect = selected === q.correct_option;

    // The (telegram_id, question_id) key makes a second tap a no-op, even if two taps race
    const ins = await env.DB.prepare(
      "INSERT OR IGNORE INTO answers (telegram_id, question_id, selected_option, is_correct, answered_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(telegramId, questionId, selected, isCorrect ? 1 : 0, new Date().toISOString()).run();
    if (!ins.meta.changes) { await ctx.answerCallbackQuery({ text: "You already answered this one." }); return; }

    if (isCorrect) {
      await env.DB.prepare("UPDATE users SET streak = streak + 1, last_answered_date = ? WHERE telegram_id = ?")
        .bind(todayAddis(), telegramId).run();
    }

    await ctx.answerCallbackQuery({
      text: isCorrect ? "Correct! 🔥 Streak +1" : "Not quite. The answer and explanation come at 2 PM.",
    });
  });
}

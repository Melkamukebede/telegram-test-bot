import { todayAddis } from "../config.js";
import { answerKeyboard, formatExpandedQuestion } from "./formatters.js";

export async function sendDailyQuiz(ctx, env, requestedDate) {
  const date = requestedDate || todayAddis();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await ctx.reply("That quiz link is invalid. Please use today's channel post.");
    return;
  }

  const { results } = await env.DB.prepare(
    "SELECT * FROM daily_questions WHERE session_date = ? AND is_posted = 1 AND is_revealed = 0 ORDER BY posted_at ASC, id ASC"
  ).bind(date).all();

  if (!results.length) {
    await ctx.reply("Today's quiz is not available yet. Check the channel after 9:00 AM.");
    return;
  }

  await ctx.reply(
    `🎯 <b>Today's private quiz</b>\n\nAnswer each question below. Your answers are recorded privately, and the explanations appear in the channel at 7:00 PM.`,
    { parse_mode: "HTML" }
  );

  for (const q of results) {
    await ctx.reply(formatExpandedQuestion(q, q.subject || "quiz"), {
      parse_mode: "HTML",
      reply_markup: answerKeyboard(q.id),
    });
  }
}

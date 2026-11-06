import { InlineKeyboard } from "grammy";
import { todayAddis, PROMO_TEXT, SINAHARD_URL } from "../config.js";
import { answerKeyboard, formatQuestionPost, formatReveal } from "./formatters.js";

// Posts whatever is still owed for today's plan. The plan's count is the
// TOTAL for the day, so running this twice (manual test, then cron) never doubles up.
export async function postDailyQuestions(env, api) {
  const today = todayAddis();
  const plan = await env.DB.prepare("SELECT * FROM daily_plan WHERE plan_date = ?")
    .bind(today).first();
  if (!plan) return { status: "no_plan", count: 0 };

  const done = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM daily_questions WHERE session_date = ? AND subject = ?"
  ).bind(today, plan.subject).first();
  const remaining = plan.question_count - done.c;
  if (remaining <= 0) return { status: "already_done", count: 0, subject: plan.subject };

  const { results } = await env.DB.prepare(
    "SELECT * FROM daily_questions WHERE subject = ? AND is_posted = 0 ORDER BY id ASC LIMIT ?"
  ).bind(plan.subject, remaining).all();
  if (!results.length) return { status: "empty", count: 0, subject: plan.subject };

  let sent = 0;
  for (const q of results) {
    await api.sendMessage(env.GROUP_CHAT_ID, formatQuestionPost(q, plan.subject), {
      reply_markup: answerKeyboard(q.id),
    });
    // Marked right after each send, so a crash mid-loop can't re-post a question
    await env.DB.prepare(
      "UPDATE daily_questions SET is_posted = 1, posted_at = ?, session_date = ? WHERE id = ?"
    ).bind(new Date().toISOString(), today, q.id).run();
    sent++;
  }
  return { status: "ok", count: sent, subject: plan.subject };
}

export async function postReveals(env, api) {
  const today = todayAddis();
  const { results } = await env.DB.prepare(
    `SELECT * FROM daily_questions
     WHERE session_date = ? AND is_posted = 1 AND is_revealed = 0
     ORDER BY id ASC`
  ).bind(today).all();

  let count = 0;
  for (const q of results) {
    await api.sendMessage(env.GROUP_CHAT_ID, formatReveal(q));
    await env.DB.prepare("UPDATE daily_questions SET is_revealed = 1 WHERE id = ?")
      .bind(q.id).run();
    count++;
  }
  return { count };
}

export async function postLeaderboard(env, api) {
  const { results } = await env.DB.prepare(
    "SELECT telegram_id, streak FROM users WHERE streak > 0 ORDER BY streak DESC LIMIT 10"
  ).all();

  if (!results.length) {
    await api.sendMessage(env.GROUP_CHAT_ID, "No streaks yet. Answer today's question to get on the board!");
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = results.map((u, i) => `${medals[i] || `${i + 1}.`} User ${u.telegram_id} — 🔥${u.streak}`);
  await api.sendMessage(env.GROUP_CHAT_ID, "🏆 Weekly Leaderboard\n\n" + lines.join("\n"));
}
export async function postPromo(env, api) {
  // CHANNEL_ID is optional. If it isn't set, the promo goes where GROUP_CHAT_ID points
  const chat = env.CHANNEL_ID || env.GROUP_CHAT_ID;
  await api.sendMessage(chat, PROMO_TEXT, {
    reply_markup: new InlineKeyboard().url("• Open Sinahard", SINAHARD_URL),
  });
}

import { InlineKeyboard } from "grammy";
import { getDailyTarget } from "../db.js";
import { todayAddis, PROMO_TEXT, SINAHARD_URL } from "../config.js";
import { answerKeyboard, formatQuestionPost, formatReveal } from "./formatters.js";

// Posts whatever is still owed for today's plan. The plan's count is the
// TOTAL for the day, so running this twice (manual test, then cron) never doubles up.
// Picks `need` questions: the /setplan subject first, then a fair round-robin
// across the other subjects. The subject posted longest ago starts the round,
// so the mix rotates from day to day.
async function pickQuestions(env, preferred, need) {
  // Window function: at most `need` oldest questions per subject (all we could ever use)
  const { results: pool } = await env.DB.prepare(
    `SELECT * FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY subject ORDER BY id) AS rn
       FROM daily_questions WHERE is_posted = 0
     ) WHERE rn <= ? ORDER BY id ASC`
  ).bind(need).all();
  if (!pool.length) return [];

  const bySubject = new Map();
  for (const q of pool) {
    const key = q.subject || "";
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push(q);
  }

  const picked = [];

  // 1) the preferred subject gets first pick
  if (preferred && bySubject.has(preferred)) {
    const list = bySubject.get(preferred);
    while (list.length && picked.length < need) picked.push(list.shift());
    bySubject.delete(preferred);
  }
  if (picked.length >= need) return picked;

  // 2) rotation order: the subject posted longest ago goes first
  const { results: last } = await env.DB.prepare(
    "SELECT subject, MAX(posted_at) AS last FROM daily_questions WHERE is_posted = 1 GROUP BY subject"
  ).all();
  const lastPosted = new Map(last.map((r) => [r.subject || "", r.last || ""]));
  const order = [...bySubject.keys()].sort(
    (a, b) => (lastPosted.get(a) || "").localeCompare(lastPosted.get(b) || "") || a.localeCompare(b)
  );

  // 3) one from each subject in turn until the quota is filled
  while (picked.length < need) {
    let took = false;
    for (const key of order) {
      const list = bySubject.get(key);
      if (list.length && picked.length < need) {
        picked.push(list.shift());
        took = true;
      }
    }
    if (!took) break; // nothing left anywhere
  }
  return picked;
}

// Fills today's quota. Safe to run any time, any number of times.
export async function postDailyQuestions(env, api) {
  const today = todayAddis();
  const target = await getDailyTarget(env);
  const plan = await env.DB.prepare("SELECT * FROM daily_plan WHERE plan_date = ?").bind(today).first();
  const total = plan ? plan.question_count : target;

  const done = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM daily_questions WHERE session_date = ?"
  ).bind(today).first();
  const need = total - done.c;

  const waiting = async () =>
    (await env.DB.prepare("SELECT COUNT(*) AS c FROM daily_questions WHERE is_posted = 0").first()).c;

  if (need <= 0) return { status: "already_done", count: 0, need: 0, left: await waiting(), target };

  const picked = await pickQuestions(env, plan ? plan.subject : "", need);
  if (!picked.length) return { status: "empty", count: 0, need, left: 0, target };

  let sent = 0;
  for (const q of picked) {
    await api.sendMessage(env.GROUP_CHAT_ID, formatQuestionPost(q, q.subject || "quiz"), {
      reply_markup: answerKeyboard(q.id),
    });
    // Marked right after each send, so a crash mid-loop can't re-post a question
    await env.DB.prepare(
      "UPDATE daily_questions SET is_posted = 1, posted_at = ?, session_date = ? WHERE id = ?"
    ).bind(new Date().toISOString(), today, q.id).run();
    sent++;
  }
  return { status: "ok", count: sent, need, left: await waiting(), target };
}

// Reveals everything that was posted but not yet revealed (also catches a missed day)
export async function postReveals(env, api) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM daily_questions WHERE is_posted = 1 AND is_revealed = 0 ORDER BY posted_at ASC, id ASC"
  ).all();

  let count = 0;
  for (const q of results) {
    await api.sendMessage(env.GROUP_CHAT_ID, formatReveal(q));
    await env.DB.prepare("UPDATE daily_questions SET is_revealed = 1 WHERE id = ?").bind(q.id).run();
    count++;
  }
  return { count };
}
export async function postLeaderboard(env, api) {
  const { results } = await env.DB.prepare(
    "SELECT first_name, streak FROM users WHERE streak > 0 ORDER BY streak DESC LIMIT 10"
  ).all();

  if (!results.length) {
    await api.sendMessage(env.GROUP_CHAT_ID, "No streaks yet. Answer today's question to get on the board!");
    return;
  }

  const clean = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim().slice(0, 20);
  const medals = ["🥇", "🥈", "🥉"];
  const lines = results.map(
    (u, i) => `${medals[i] || `${i + 1}.`} ${clean(u.first_name) || "Student"} — 🔥${u.streak}`
  );
  await api.sendMessage(env.GROUP_CHAT_ID, "🏆 Leaderboard\n\n" + lines.join("\n"));
}
export async function postPromo(env, api) {
  // CHANNEL_ID is optional. If it isn't set, the promo goes where GROUP_CHAT_ID points
  const chat = env.CHANNEL_ID || env.GROUP_CHAT_ID;
  await api.sendMessage(chat, PROMO_TEXT, {
    reply_markup: new InlineKeyboard().url("• Open Sinahard", SINAHARD_URL),
  });
}

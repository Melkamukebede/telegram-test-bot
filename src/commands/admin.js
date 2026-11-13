import { requireAdmin } from "../auth.js";
import { todayAddis } from "../config.js";
import { getDailyTarget, setSetting, isPaused } from "../db.js";
import { postDailyQuestions, postReveals, postPromo } from "../services/scheduler.js";
import { syncMenuFor } from "../services/menu.js";

// Accepts 1-4 or A-D
function parseCorrect(s) {
  const t = s.trim().toUpperCase();
  if (/^[1-4]$/.test(t)) return Number(t);
  const i = "ABCD".indexOf(t);
  return t.length === 1 && i >= 0 ? i + 1 : null;
}

export function registerAdminCommands(bot, env) {
  // ================================
  // Adding questions
  // ================================

  // /addquestion subject | Question | Option A | Option B | Option C | Option D | B
  bot.command("addquestion", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;

    const parts = ctx.match.split("|").map((p) => p.trim());
    const usage =
      "Usage:\n/addquestion subject | Question | Option A | Option B | Option C | Option D | correct (A-D)\n\n" +
      "Tip: to add many questions at once, send a .txt file instead.";
    if (parts.length !== 7 || parts.some((p) => !p)) { await ctx.reply(usage); return; }

    const [subject, text, a, b, c, d, correctRaw] = parts;
    const correct = parseCorrect(correctRaw);
    if (!correct) { await ctx.reply("The correct answer must be A, B, C or D."); return; }

    await env.DB.prepare(
      `INSERT INTO daily_questions
       (subject, question_text, option1, option2, option3, option4, correct_option, post_date, is_posted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(subject.toLowerCase(), text, a, b, c, d, correct, todayAddis()).run();

    await ctx.reply(`Question added under "${subject.toLowerCase()}".`);
  });

  bot.command("queue", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const { results } = await env.DB.prepare(
      "SELECT subject, COUNT(*) AS c FROM daily_questions WHERE is_posted = 0 GROUP BY subject"
    ).all();
    await ctx.reply(
      results.length
        ? "📥 Unposted questions:\n" + results.map((r) => `${r.subject}: ${r.c}`).join("\n")
        : "The queue is empty."
    );
  });

  // Removes only UNPOSTED questions from an import
  bot.command("undobatch", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const id = ctx.match.trim();
    if (!id) { await ctx.reply("Usage: /undobatch <batch_id>"); return; }
    const r = await env.DB.prepare("DELETE FROM daily_questions WHERE batch_id = ? AND is_posted = 0")
      .bind(id).run();
    await ctx.reply(`Removed ${r.meta.changes} unposted question(s) from batch ${id}.`);
  });

  // Removes all posted questions and their submitted answers
  bot.command("deleteallposted", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;

    const { results } = await env.DB.prepare(
      "SELECT id FROM daily_questions WHERE is_posted = 1"
    ).all();
    if (!results.length) {
      await ctx.reply("There are no posted questions to delete.");
      return;
    }

    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM answers WHERE question_id IN (SELECT id FROM daily_questions WHERE is_posted = 1)"
      ).bind(),
      env.DB.prepare("DELETE FROM daily_questions WHERE is_posted = 1").bind(),
    ]);

    await ctx.reply(`Deleted ${results.length} posted question(s) and their answers.`);
  });

  // ================================
  // Daily quota and plan
  // ================================

  // /setplan <subject> [count]
  // This subject goes first today. Count = total for today (default: the daily quota).
  bot.command("setplan", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;

    const [subjectRaw, countRaw] = ctx.match.trim().split(/\s+/);
    const count = countRaw === undefined ? await getDailyTarget(env) : parseInt(countRaw, 10);
    if (!subjectRaw || Number.isNaN(count) || count < 1 || count > 20) {
      await ctx.reply("Usage: /setplan <subject> [count 1-20]\nExample: /setplan logic 4");
      return;
    }
    const subject = subjectRaw.toLowerCase();

    await env.DB.prepare(
      `INSERT INTO daily_plan (plan_date, subject, question_count) VALUES (?, ?, ?)
       ON CONFLICT(plan_date) DO UPDATE SET subject = excluded.subject, question_count = excluded.question_count`
    ).bind(todayAddis(), subject, count).run();

    const avail = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM daily_questions WHERE subject = ? AND is_posted = 0"
    ).bind(subject).first();

    await ctx.reply(
      `Today's plan: ${count} question(s), "${subject}" first.\n"${subject}" questions waiting: ${avail.c}` +
        (avail.c < count ? "\nIf it runs out, the bot fills the rest from other subjects." : "")
    );
  });

  // /setdaily <1-20>: how many questions post every day
  bot.command("setdaily", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const n = parseInt(ctx.match.trim(), 10);
    if (Number.isNaN(n) || n < 1 || n > 20) {
      await ctx.reply("Usage: /setdaily <1-20>\nExample: /setdaily 4");
      return;
    }
    await setSetting(env, "daily_target", n);
    await ctx.reply(`Daily quota set to ${n}. Questions post at 9:00 AM, answers at 7:00 PM.`);
  });

  bot.command("pause", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    await setSetting(env, "paused", "1");
    await ctx.reply(
      "⏸ Auto-posting paused. No questions will post at 9 AM until you send /resume.\n" +
        "Answers for questions already posted still go out at 7 PM. /testquestion still works by hand."
    );
  });

  bot.command("resume", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    await setSetting(env, "paused", "0");
    await ctx.reply(
      "▶️ Auto-posting resumed. The next questions post at 9:00 AM. If it's already past 9 AM, send /testquestion to post today's now."
    );
  });

  // Today's numbers at a glance
  bot.command("today", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;

    const today = todayAddis();
    const target = await getDailyTarget(env);
    const plan = await env.DB.prepare("SELECT * FROM daily_plan WHERE plan_date = ?").bind(today).first();

    const count = async (where, ...args) => {
      const stmt = env.DB.prepare(`SELECT COUNT(*) AS c FROM daily_questions WHERE ${where}`);
      return (await (args.length ? stmt.bind(...args) : stmt).first()).c;
    };
    const posted = await count("session_date = ?", today);
    const waiting = await count("is_posted = 0");
    const open = await count("is_posted = 1 AND is_revealed = 0");
    const total = plan ? plan.question_count : target;

    await ctx.reply(
      ((await isPaused(env)) ? "⏸ PAUSED (send /resume)\n" : "") +
        `📅 ${today}\n` +
        `Quota today: ${total}${plan ? ` (${plan.subject} first)` : " (default)"}\n` +
        `Posted today: ${posted}\n` +
        `Still to post: ${Math.max(total - posted, 0)}\n` +
        `Waiting in queue: ${waiting}\n` +
        `Awaiting answer reveal: ${open}\n\n` +
        "⏰ 9:00 AM questions · 7:00 PM answers"
    );
  });

  // ================================
  // Manual posting (for testing or catching up)
  // ================================
  bot.command("testquestion", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const r = await postDailyQuestions(env, bot.api);
    const messages = {
      ok: `Posted ${r.count} question(s). ${r.left} left in the queue.`,
      already_done: "Today's quota is already posted. Raise it with /setdaily or /setplan.",
      empty: "The queue is empty. Upload more questions.",
    };
    await ctx.reply(messages[r.status]);
  });

  bot.command("testreveal", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const r = await postReveals(env, bot.api);
    await ctx.reply(
      r.count
        ? `Revealed ${r.count} answer(s) in order.`
        : "Nothing to reveal: no posted, unrevealed questions."
    );
  });

  bot.command("testpromo", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    await postPromo(env, bot.api);
    await ctx.reply("Promo posted to the channel.");
  });

  // ================================
  // Information
  // ================================
  bot.command("poststats", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const total = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first();
    const done = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM users WHERE university IS NOT NULL AND step IS NULL"
    ).first();
    await ctx.reply(`Users started: ${total.c}\nRegistration finished: ${done.c}`);
  });

  bot.command("admins", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const { results } = await env.DB.prepare("SELECT telegram_id FROM admins").all();
    const list = results.map((a) => `• ${a.telegram_id}`).join("\n");
    await ctx.reply(`Owner: ${String(env.ADMIN_ID).trim()}\n\nAdmins:\n${list || "(none yet)"}`);
  });

  // ================================
  // Owner only: manage admins
  // ================================
  bot.command("addadmin", async (ctx) => {
    if (!(await requireAdmin(ctx, env, true))) return;
    const newId = ctx.match.trim();
    if (!/^\d+$/.test(newId)) { await ctx.reply("Usage: /addadmin <telegram_user_id>"); return; }

    await env.DB.prepare("INSERT OR IGNORE INTO admins (telegram_id, added_by, added_at) VALUES (?, ?, ?)")
      .bind(newId, String(ctx.from.id), new Date().toISOString()).run();

    const synced = await syncMenuFor(bot.api, newId, "admin");
    await ctx.reply(
      `Added ${newId} as admin.\n` +
        (synced
          ? "Their command menu now shows the admin commands."
          : "Ask them to send /start to the bot once, so their menu and /help update.")
    );
  });

  bot.command("removeadmin", async (ctx) => {
    if (!(await requireAdmin(ctx, env, true))) return;
    const id = ctx.match.trim();
    if (!/^\d+$/.test(id)) { await ctx.reply("Usage: /removeadmin <telegram_user_id>"); return; }
    if (id === String(env.ADMIN_ID).trim()) { await ctx.reply("The owner can't be removed."); return; }

    await env.DB.prepare("DELETE FROM admins WHERE telegram_id = ?").bind(id).run();
    await syncMenuFor(bot.api, id, "student"); // their menu goes back to the student list
    await ctx.reply(`Removed ${id} from admins.`);
  });
}

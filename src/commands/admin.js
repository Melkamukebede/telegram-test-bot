import { requireAdmin, isOwner } from "../auth.js";
import { todayAddis } from "../config.js";
import { postDailyQuestions, postReveals, postPromo } from "../services/scheduler.js";

// Accepts 1-4 or A-D
function parseCorrect(s) {
  const t = s.trim().toUpperCase();
  if (/^[1-4]$/.test(t)) return Number(t);
  const i = "ABCD".indexOf(t);
  return t.length === 1 && i >= 0 ? i + 1 : null;
}

export function registerAdminCommands(bot, env) {
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

  // /setplan biology 3  (3 = total questions for today)
  bot.command("setplan", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;

    const [subjectRaw, countRaw] = ctx.match.trim().split(/\s+/);
    const count = parseInt(countRaw, 10);
    if (!subjectRaw || Number.isNaN(count) || count < 1 || count > 20) {
      await ctx.reply("Usage: /setplan <subject> <count 1-20>\nExample: /setplan td 3");
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
      `Plan set: ${count} "${subject}" question(s) today.\nUnposted in the queue: ${avail.c}` +
        (avail.c < count ? "\n⚠️ Fewer than the plan needs. Upload more questions." : "")
    );
  });

  bot.command("testquestion", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const r = await postDailyQuestions(env, bot.api);
    const messages = {
      ok: `Sent ${r.count} question(s) to the group.`,
      no_plan: "No plan for today. Use /setplan <subject> <count> first.",
      already_done: `Today's plan is already fully posted. Raise the count with /setplan to post more.`,
      empty: `No unposted questions left for "${r.subject}".`,
    };
    await ctx.reply(messages[r.status]);
  });

  bot.command("testreveal", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const r = await postReveals(env, bot.api);
    await ctx.reply(r.count ? `Revealed ${r.count} answer(s) in order.` : "Nothing to reveal: no posted, unrevealed questions today.");
  });

  bot.command("poststats", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const total = await env.DB.prepare("SELECT COUNT(*) AS c FROM users").first();
    const done = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM users WHERE university IS NOT NULL AND step IS NULL"
    ).first();
    await ctx.reply(`Users started: ${total.c}\nRegistration finished: ${done.c}`);
  });

  bot.command("queue", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const { results } = await env.DB.prepare(
      "SELECT subject, COUNT(*) AS c FROM daily_questions WHERE is_posted = 0 GROUP BY subject"
    ).all();
    await ctx.reply(
      results.length ? "📥 Unposted questions:\n" + results.map((r) => `${r.subject}: ${r.c}`).join("\n") : "The queue is empty."
    );
  });

  // Removes only UNPOSTED questions from an import
  bot.command("undobatch", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const id = ctx.match.trim();
    if (!id) { await ctx.reply("Usage: /undobatch <batch_id>"); return; }
    const r = await env.DB.prepare("DELETE FROM daily_questions WHERE batch_id = ? AND is_posted = 0").bind(id).run();
    await ctx.reply(`Removed ${r.meta.changes} unposted question(s) from batch ${id}.`);
  });

  // ---- owner-only admin management ----
  bot.command("addadmin", async (ctx) => {
    if (!(await requireAdmin(ctx, env, true))) return;
    const newId = ctx.match.trim();
    if (!/^\d+$/.test(newId)) { await ctx.reply("Usage: /addadmin <telegram_user_id>"); return; }
    await env.DB.prepare("INSERT OR IGNORE INTO admins (telegram_id, added_by, added_at) VALUES (?, ?, ?)")
      .bind(newId, String(ctx.from.id), new Date().toISOString()).run();
    await ctx.reply(`Added ${newId} as admin.`);
  });

  bot.command("removeadmin", async (ctx) => {
    if (!(await requireAdmin(ctx, env, true))) return;
    const id = ctx.match.trim();
    await env.DB.prepare("DELETE FROM admins WHERE telegram_id = ?").bind(id).run();
    await ctx.reply(`Removed ${id} from admins.`);
  });

  bot.command("admins", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const { results } = await env.DB.prepare("SELECT telegram_id FROM admins").all();
    const list = results.map((a) => `• ${a.telegram_id}`).join("\n");
    await ctx.reply(`Owner: ${String(env.ADMIN_ID).trim()}\n\nAdmins:\n${list || "(none yet)"}`);
  });
}

import { isPrivate } from "../auth.js";
import { getExamSubjects, getSubjectExamSummary, getUser, upsertUser } from "../db.js";
import { FLOW, questionText } from "../config.js";

// A number picks from the list (the last one is "Other"); anything else is saved as typed.
function pick(list, text) {
  const n = parseInt(text, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= list.length) return list[n - 1];
  return text.slice(0, 80);
}

async function subjectPrompt(env, telegramId, step = 1) {
  const subjects = await getExamSubjects(env);
  if (!subjects.length) return "Registration is temporarily unavailable because no exam subjects have been added yet.";
  const selected = await env.DB.prepare(
    "SELECT subject_id FROM user_exam_subjects WHERE telegram_id = ?"
  ).bind(telegramId).all();
  const used = new Set((selected.results || []).map((r) => r.subject_id));
  const available = subjects.filter((s) => !used.has(s.id));
  if (!available.length) return "No more exam subjects are available.";
  return `📚 Choose subject ${step} of 3:\n\n` +
    available.map((s, i) => `${i + 1}. ${s.display_name}`).join("\n") +
    "\n\nReply with the number.";
}

async function finishRegistration(ctx, env, id) {
  const u = await getUser(env, id);
  const exams = await getSubjectExamSummary(env, id);
  const examLines = exams.length
    ? exams.map((e) => `• ${e.display_name} — ${e.exam_type} ${e.exam_year} (${e.question_count} questions)`).join("\n")
    : "No exams are available yet. New exams will appear when uploaded.";
  await ctx.reply(
    "✅ Registration Complete!\n\n" +
      `University: ${u.university}\nMajor: ${u.major}\nCity: ${u.city}\nSemester: ${u.semester}\n\n` +
      "📚 Your exam subjects:\n" + examLines +
      "\n\nUse /exams to view your practice library."
  );
}

// Must be registered LAST: it answers every private text message nothing else claimed.
export function registerRegistration(bot, env) {
  bot.on("message:text", async (ctx) => {
    if (!isPrivate(ctx)) return;

    const id = String(ctx.from.id);
    const text = ctx.message.text.trim();
    const user = await getUser(env, id);

    if (!user || !user.step) {
      await ctx.reply("Type /register to get started, or /menu for options.");
      return;
    }
    if (text.startsWith("/")) {
      await ctx.reply("I don't know that command. Finish the question above, or type /menu.");
      return;
    }

    if (user.step.startsWith("awaiting_subject_")) {
      const step = Number(user.step.slice("awaiting_subject_".length));
      const subjects = await getExamSubjects(env);
      const selected = await env.DB.prepare(
        "SELECT subject_id FROM user_exam_subjects WHERE telegram_id = ?"
      ).bind(id).all();
      const used = new Set((selected.results || []).map((r) => r.subject_id));
      const available = subjects.filter((s) => !used.has(s.id));
      const n = parseInt(text, 10);
      if (!Number.isInteger(n) || n < 1 || n > available.length) {
        await ctx.reply(await subjectPrompt(env, id, step));
        return;
      }
      await env.DB.prepare(
        "INSERT INTO user_exam_subjects (telegram_id, subject_id, selected_at) VALUES (?, ?, ?)"
      ).bind(id, available[n - 1].id, new Date().toISOString()).run();
      if (step < 3) {
        await upsertUser(env, id, { step: `awaiting_subject_${step + 1}` });
        await ctx.reply(await subjectPrompt(env, id, step + 1));
      } else {
        await upsertUser(env, id, { step: null });
        await finishRegistration(ctx, env, id);
      }
      return;
    }

    const i = FLOW.findIndex((s) => s.step === user.step);
    if (i === -1) {
      await ctx.reply("Something went off track. Type /register to start over.");
      return;
    }

    const value = pick(FLOW[i].list, text);

    if (i < FLOW.length - 1) {
      await upsertUser(env, id, { [FLOW[i].field]: value, step: FLOW[i + 1].step });
      await ctx.reply(questionText(i + 1));
      return;
    }

    await upsertUser(env, id, { [FLOW[i].field]: value, step: "awaiting_subject_1" });
    await ctx.reply(await subjectPrompt(env, id, 1));
  });
}

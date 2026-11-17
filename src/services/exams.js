import { InlineKeyboard } from "grammy";
import { requireExamAccess } from "./referrals.js";

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function questionText(q, index, total) {
  const text = `<b>Question ${index + 1} of ${total}</b>\n\n` +
    `${esc(q.question_text)}\n\n` +
    `A) ${esc(q.option1)}\nB) ${esc(q.option2)}\n` +
    `C) ${esc(q.option3)}\nD) ${esc(q.option4)}`;
  return text.length <= 3900 ? text : `${text.slice(0, 3899)}…`;
}

function answerButtons(attemptId, questionId, disabled = false) {
  if (disabled) return new InlineKeyboard();
  return new InlineKeyboard()
    .text("A", `exam_answer_${attemptId}_${questionId}_1`)
    .text("B", `exam_answer_${attemptId}_${questionId}_2`)
    .row()
    .text("C", `exam_answer_${attemptId}_${questionId}_3`)
    .text("D", `exam_answer_${attemptId}_${questionId}_4`);
}

async function selectedExam(env, telegramId, examId) {
  return env.DB.prepare(
    `SELECT e.*, s.display_name FROM exams e
     JOIN exam_subjects s ON s.id = e.subject_id
     JOIN user_exam_subjects us ON us.subject_id = s.id AND us.telegram_id = ?
     WHERE e.id = ? AND e.is_published = 1`
  ).bind(telegramId, examId).first();
}

export async function examCatalog(env, telegramId) {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.title, e.exam_type, e.exam_year, e.duration_minutes,
            s.display_name, COUNT(q.id) AS question_count
     FROM exams e
     JOIN exam_subjects s ON s.id = e.subject_id
     JOIN user_exam_subjects us ON us.subject_id = s.id AND us.telegram_id = ?
     LEFT JOIN exam_questions q ON q.exam_id = e.id
     WHERE e.is_published = 1
     GROUP BY e.id
     HAVING COUNT(q.id) > 0
     ORDER BY s.display_name, e.exam_year DESC, e.exam_type`
  ).bind(telegramId).all();
  return results || [];
}

export async function sendExamCatalog(ctx, env) {
  if (!(await requireExamAccess(ctx, env))) return;
  const exams = await examCatalog(env, String(ctx.from.id));
  if (!exams.length) {
    await ctx.reply("No published exams are available for your selected subjects yet.");
    return;
  }
  const keyboard = new InlineKeyboard();
  for (const exam of exams) {
    keyboard.text(
      `${exam.display_name} • ${exam.exam_type.toUpperCase()} ${exam.exam_year}`,
      `exam_start_${exam.id}`
    ).row();
  }
  await ctx.reply("📚 <b>Choose an exam to practice</b>\n\nEach exam is private and scored when you finish.", {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

export async function startExam(ctx, env, examId) {
  if (!(await requireExamAccess(ctx, env))) {
    await ctx.answerCallbackQuery({ text: "Unlock exam access first.", show_alert: true });
    return;
  }
  const telegramId = String(ctx.from.id);
  const exam = await selectedExam(env, telegramId, examId);
  if (!exam) {
    await ctx.answerCallbackQuery({ text: "This exam is not available for your account.", show_alert: true });
    return;
  }
  const { results: questions } = await env.DB.prepare(
    "SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY question_number"
  ).bind(examId).all();
  if (!questions.length) {
    await ctx.answerCallbackQuery({ text: "This exam has no questions yet.", show_alert: true });
    return;
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM exam_attempts WHERE telegram_id = ? AND exam_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
  ).bind(telegramId, examId).first();
  const attemptId = existing
    ? existing.id
    : (await env.DB.prepare(
      `INSERT INTO exam_attempts
       (telegram_id, exam_id, total_questions, started_at)
       VALUES (?, ?, ?, ?)`
    ).bind(telegramId, examId, questions.length, new Date().toISOString()).run()).meta.last_row_id;
  await ctx.answerCallbackQuery({ text: existing ? "Resuming exam." : "Exam started." });
  await ctx.reply(
    `<b>${esc(exam.title)}</b>\n⏱ ${exam.duration_minutes} minutes\n\n` +
    `Answer all ${questions.length} questions. Your score will appear at the end.`,
    { parse_mode: "HTML" }
  );
  await sendCurrentQuestion(ctx, env, attemptId);
}

export async function sendCurrentQuestion(ctx, env, attemptId) {
  const attempt = await env.DB.prepare(
    `SELECT a.*, e.title FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
     WHERE a.id = ? AND a.telegram_id = ? AND a.status = 'active'`
  ).bind(attemptId, String(ctx.from.id)).first();
  if (!attempt) {
    await ctx.reply("This exam attempt is no longer active.");
    return;
  }
  const q = await env.DB.prepare(
    "SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY question_number LIMIT 1 OFFSET ?"
  ).bind(attempt.exam_id, attempt.current_index).first();
  if (!q) {
    await finishExam(ctx, env, attempt.id);
    return;
  }
  await ctx.reply(questionText(q, attempt.current_index, attempt.total_questions), {
    parse_mode: "HTML",
    reply_markup: answerButtons(attempt.id, q.id),
  });
}

export async function answerExam(ctx, env, attemptId, questionId, selected) {
  const userId = String(ctx.from.id);
  const attempt = await env.DB.prepare(
    "SELECT * FROM exam_attempts WHERE id = ? AND telegram_id = ? AND status = 'active'"
  ).bind(attemptId, userId).first();
  if (!attempt) {
    await ctx.answerCallbackQuery({ text: "This exam attempt is closed." });
    return;
  }
  const q = await env.DB.prepare(
    "SELECT * FROM exam_questions WHERE id = ? AND exam_id = ?"
  ).bind(questionId, attempt.exam_id).first();
  if (!q) {
    await ctx.answerCallbackQuery({ text: "Question not found." });
    return;
  }
  const saved = await env.DB.prepare(
    "INSERT OR IGNORE INTO exam_answers (attempt_id, question_id, selected_option, is_correct, answered_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(attemptId, questionId, selected, selected === q.correct_option ? 1 : 0, new Date().toISOString()).run();
  if (!saved.meta.changes) {
    await ctx.answerCallbackQuery({ text: "Already answered." });
    return;
  }
  const nextIndex = attempt.current_index + 1;
  await env.DB.prepare(
    "UPDATE exam_attempts SET current_index = ?, score = score + ? WHERE id = ?"
  ).bind(nextIndex, selected === q.correct_option ? 1 : 0, attemptId).run();
  await ctx.answerCallbackQuery({ text: selected === q.correct_option ? "Correct!" : "Answer recorded." });
  await ctx.editMessageReplyMarkup({ reply_markup: answerButtons(attemptId, questionId, true) });
  await sendCurrentQuestion(ctx, env, attemptId);
}

async function finishExam(ctx, env, attemptId) {
  const attempt = await env.DB.prepare(
    `SELECT a.*, e.title FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
     WHERE a.id = ? AND a.telegram_id = ?`
  ).bind(attemptId, String(ctx.from.id)).first();
  if (!attempt) return;
  if (attempt.status === "active") {
    await env.DB.prepare(
      "UPDATE exam_attempts SET status = 'completed', completed_at = ? WHERE id = ?"
    ).bind(new Date().toISOString(), attemptId).run();
  }
  const percent = Math.round((attempt.score / attempt.total_questions) * 100);
  await ctx.reply(
    `🏁 <b>Exam complete!</b>\n\n<b>${esc(attempt.title)}</b>\n` +
    `Score: <b>${attempt.score}/${attempt.total_questions}</b> (${percent}%)\n\n` +
    `Use /exams to practice another exam.`,
    { parse_mode: "HTML" }
  );
}

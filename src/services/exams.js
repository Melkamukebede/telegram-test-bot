import { InlineKeyboard } from "grammy";
const PAGE_SIZE = 4;
const LETTERS = ["A", "B", "C", "D"];

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function answerButtons(attemptId, questionId, page, answer) {
  const keyboard = new InlineKeyboard();
  for (let option = 1; option <= 4; option++) {
    const selected = answer?.selected_option === option;
    keyboard.text(
      answer
        ? `${LETTERS[option - 1]}${selected ? " ✓" : ""}`
        : LETTERS[option - 1],
      `exam_answer_${attemptId}_${questionId}_${option}_${page}`
    );
    if (option === 2) keyboard.row();
  }
  return keyboard;
}

function renderQuestion(q, answer, index) {
  let text = `<b>${index + 1}. ${esc(q.question_text)}</b>\n\n` +
    `A) ${esc(q.option1)}\nB) ${esc(q.option2)}\n` +
    `C) ${esc(q.option3)}\nD) ${esc(q.option4)}`;
  if (!answer) return `${text}\n\n<i>Select A, B, C, or D to reveal the answer.</i>`;

  const correct = [q.option1, q.option2, q.option3, q.option4][q.correct_option - 1];
  text += `\n\n${answer.is_correct ? "✅ Correct" : "❌ Incorrect"}` +
    `\n<b>Your choice:</b> ${LETTERS[answer.selected_option - 1]})` +
    `\n<b>Answer:</b> ${LETTERS[q.correct_option - 1]}) ${esc(correct)}`;
  if (q.explanation) text += `\n<b>Explanation:</b> ${esc(q.explanation)}`;
  return text;
}

async function selectedExam(env, telegramId, examId) {
  return env.DB.prepare(
    `SELECT e.*, s.display_name FROM exams e
     JOIN exam_subjects s ON s.id = e.subject_id
     WHERE e.id = ? AND e.is_published = 1`
  ).bind(examId).first();
}

export async function examCatalog(env, telegramId) {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.title, e.exam_type, e.exam_year, e.duration_minutes,
            s.display_name, COUNT(q.id) AS question_count
            , EXISTS(
                SELECT 1 FROM exam_attempts active_attempt
                WHERE active_attempt.exam_id = e.id
                  AND active_attempt.telegram_id = ?
                  AND active_attempt.status = 'active'
              ) AS is_active
     FROM exams e
     JOIN exam_subjects s ON s.id = e.subject_id
     LEFT JOIN exam_questions q ON q.exam_id = e.id
     WHERE e.is_published = 1
     GROUP BY e.id
     HAVING COUNT(q.id) > 0
     ORDER BY is_active DESC, s.display_name, e.exam_year DESC, e.exam_type`
  ).bind(telegramId).all();
  return results || [];
}

export async function sendExamCatalog(ctx, env) {
  const telegramId = String(ctx.from.id);
  const exams = await examCatalog(env, telegramId);
  if (!exams.length) {
    await ctx.reply("📚 No published exams are available yet.\n\nNew exams will appear here when an admin adds them.");
    return;
  }
  const keyboard = new InlineKeyboard();
  for (const exam of exams) {
    keyboard.text(
      `${exam.is_active ? "▶️ Resume" : "📝"} ${exam.display_name} • ${exam.exam_type.toUpperCase()} ${exam.exam_year}`,
      `exam_start_${exam.id}`
    ).row();
  }
  await ctx.reply(
    "📚 <b>Choose an exam to practice</b>\n\nEach page contains four questions. Answers and explanations appear after each choice.",
    { parse_mode: "HTML", reply_markup: keyboard }
  );
}

async function getAttempt(env, telegramId, attemptId) {
  return env.DB.prepare(
    `SELECT a.*, e.title FROM exam_attempts a
     JOIN exams e ON e.id = a.exam_id
     WHERE a.id = ? AND a.telegram_id = ? AND a.status = 'active'`
  ).bind(attemptId, telegramId).first();
}

async function getPage(env, attempt, page) {
  const { results: questions } = await env.DB.prepare(
    "SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY question_number LIMIT ? OFFSET ?"
  ).bind(attempt.exam_id, PAGE_SIZE, page * PAGE_SIZE).all();
  if (!questions.length) return null;

  const placeholders = questions.map(() => "?").join(", ");
  const { results: answers } = await env.DB.prepare(
    `SELECT * FROM exam_answers WHERE attempt_id = ? AND question_id IN (${placeholders})`
  ).bind(attempt.id, ...questions.map((q) => q.id)).all();
  const answerMap = new Map((answers || []).map((a) => [a.question_id, a]));
  const text = questions.map((q, i) =>
    renderQuestion(q, answerMap.get(q.id), page * PAGE_SIZE + i)
  ).join("\n\n──────────\n\n");
  const keyboard = new InlineKeyboard();
  questions.forEach((q, i) => {
    const answer = answerMap.get(q.id);
    const buttons = answerButtons(attempt.id, q.id, page, answer);
    for (const row of buttons.inline_keyboard) keyboard.inline_keyboard.push(row);
    if (i < questions.length - 1) keyboard.row();
  });

  const allAnswered = questions.every((q) => answerMap.has(q.id));
  const hasNext = questions.length === PAGE_SIZE &&
    (page + 1) * PAGE_SIZE < attempt.total_questions;
  if (hasNext && allAnswered) {
    keyboard.row().text("➡️ Next 4 questions", `exam_page_${attempt.id}_${page + 1}`);
  }
  if (text.length > 3900) {
    return {
      text: `${text.slice(0, 3899)}…\n\n<i>Some text was shortened to fit Telegram.</i>`,
      keyboard,
      allAnswered,
      hasNext,
    };
  }
  return { text, keyboard, allAnswered, hasNext };
}

async function sendPage(ctx, env, attemptId, page, edit = false) {
  const attempt = await getAttempt(env, String(ctx.from.id), attemptId);
  if (!attempt) {
    await ctx.reply("This exam attempt is no longer active.");
    return;
  }
  const view = await getPage(env, attempt, page);
  if (!view) {
    await finishExam(ctx, env, attemptId);
    return;
  }
  const header = `<b>${esc(attempt.title)}</b>\n📄 Page ${page + 1} • Answered questions are revealed below.\n\n`;
  if (edit) {
    await ctx.editMessageText(header + view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  } else {
    await ctx.reply(header + view.text, { parse_mode: "HTML", reply_markup: view.keyboard });
  }
}

async function firstUnansweredPage(env, attempt) {
  const row = await env.DB.prepare(
    `SELECT q.question_number
     FROM exam_questions q
     LEFT JOIN exam_answers a ON a.question_id = q.id AND a.attempt_id = ?
     WHERE q.exam_id = ? AND a.question_id IS NULL
     ORDER BY q.question_number LIMIT 1`
  ).bind(attempt.id, attempt.exam_id).first();
  return row ? Math.floor((Number(row.question_number) - 1) / PAGE_SIZE) : 0;
}

export async function startExam(ctx, env, examId) {
  const telegramId = String(ctx.from.id);
  const exam = await selectedExam(env, telegramId, examId);
  if (!exam) {
    await ctx.answerCallbackQuery({ text: "This exam is not available for your account.", show_alert: true });
    return;
  }
  const { results: questions } = await env.DB.prepare(
    "SELECT id FROM exam_questions WHERE exam_id = ? ORDER BY question_number"
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
    `Four questions per page. Select an option under each question to reveal its answer and explanation.`,
    { parse_mode: "HTML" }
  );
  const activeAttempt = await getAttempt(env, telegramId, attemptId);
  await sendPage(ctx, env, attemptId, await firstUnansweredPage(env, activeAttempt));
}

export async function answerExam(ctx, env, attemptId, questionId, selected, page) {
  const userId = String(ctx.from.id);
  const attempt = await getAttempt(env, userId, attemptId);
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
    `INSERT OR IGNORE INTO exam_answers
     (attempt_id, question_id, selected_option, is_correct, answered_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(attemptId, questionId, selected, selected === q.correct_option ? 1 : 0, new Date().toISOString()).run();
  if (!saved.meta.changes) {
    await ctx.answerCallbackQuery({ text: "Already answered." });
    return;
  }
  await env.DB.prepare(
    "UPDATE exam_attempts SET score = score + ? WHERE id = ?"
  ).bind(selected === q.correct_option ? 1 : 0, attemptId).run();
  await ctx.answerCallbackQuery({
    text: selected === q.correct_option ? "Correct! Answer revealed." : "Answer and explanation revealed.",
  });
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM exam_answers WHERE attempt_id = ?"
  ).bind(attemptId).first();
  if (Number(count.count) >= attempt.total_questions) {
    await sendPage(ctx, env, attemptId, page, true);
    await finishExam(ctx, env, attemptId);
    return;
  }
  await sendPage(ctx, env, attemptId, page, true);
}

export async function nextExamPage(ctx, env, attemptId, page) {
  const attempt = await getAttempt(env, String(ctx.from.id), attemptId);
  if (!attempt) {
    await ctx.answerCallbackQuery({ text: "This exam attempt is closed." });
    return;
  }
  const current = await getPage(env, attempt, page - 1);
  if (!current?.allAnswered) {
    await ctx.answerCallbackQuery({ text: "Answer all four questions first.", show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await sendPage(ctx, env, attemptId, page, true);
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
  const fresh = await env.DB.prepare(
    "SELECT score, total_questions FROM exam_attempts WHERE id = ?"
  ).bind(attemptId).first();
  const percent = Math.round((fresh.score / fresh.total_questions) * 100);
  await ctx.reply(
    `🏁 <b>Exam complete!</b>\n\n<b>${esc(attempt.title)}</b>\n` +
    `Score: <b>${fresh.score}/${fresh.total_questions}</b> (${percent}%)\n\n` +
    "Use /exams to practice another exam.",
    { parse_mode: "HTML" }
  );
}

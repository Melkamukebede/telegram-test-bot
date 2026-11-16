import { InlineKeyboard } from "grammy";

const LETTERS = ["A", "B", "C", "D"];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function limitText(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

// Button data stays numeric (1-4); only the labels students see are letters.
export function answerKeyboard(questionId) {
  return new InlineKeyboard()
    .text("A", `answer_${questionId}_1`).text("B", `answer_${questionId}_2`)
    .row()
    .text("C", `answer_${questionId}_3`).text("D", `answer_${questionId}_4`);
}

export function questionKeyboard(questionId) {
  return new InlineKeyboard().text("👁 View question", `view_question_${questionId}`);
}

export function revealKeyboard(questionId) {
  return new InlineKeyboard().text("👁 View answer", `view_answer_${questionId}`);
}

export function formatQuestionPost(q, subject) {
  const topic = q.topic ? `\n📖 <b>Topic:</b> ${escapeHtml(q.topic)}` : "";
  return (
    `<b>❓ ${escapeHtml(String(subject).toUpperCase())} — Question of the Day</b>${topic}\n\n` +
    `<i>Question hidden to keep the chat clean. Tap below when you are ready to practice.</i>`
  );
}

export function formatDailyCard(questions) {
  const subjects = [...new Set(questions.map((q) => escapeHtml(String(q.subject || "Quiz").toUpperCase())))];
  return (
    `<b>🎯 Daily Challenge</b>\n\n` +
    `<b>${questions.length} questions</b> • ${subjects.join(" • ")}\n` +
    `<i>Test yourself in 2 minutes. Answers and explanations arrive at 7:00 PM.</i>\n\n` +
    `🔥 Build your streak and see how you rank!`
  );
}

export function formatDailyReveal(questions) {
  const lines = questions.map((q, i) => {
    const options = [q.option1, q.option2, q.option3, q.option4];
    const answer = options[q.correct_option - 1];
    const explanation = q.explanation
      ? `\n💡 ${escapeHtml(limitText(String(q.explanation), 600))}`
      : "";
    return `${i + 1}. <b>${escapeHtml(String(q.subject || "Quiz").toUpperCase())}</b>\n✅ <b>${LETTERS[q.correct_option - 1]}) ${escapeHtml(answer)}</b>${explanation}`;
  });
  return `<b>✅ Daily Answers</b>\n\n${limitText(lines.join("\n\n"), 3900)}\n\n<i>Keep practicing and come back tomorrow! 🔥</i>`;
}

export function formatExpandedQuestion(q, subject) {
  const topic = q.topic ? `\n📖 <b>Topic:</b> ${escapeHtml(q.topic)}` : "";
  const question =
    `${escapeHtml(q.question_text)}\n\n` +
    `A) ${escapeHtml(q.option1)}\n` +
    `B) ${escapeHtml(q.option2)}\n` +
    `C) ${escapeHtml(q.option3)}\n` +
    `D) ${escapeHtml(q.option4)}`;

  return (
    `<b>❓ ${escapeHtml(String(subject).toUpperCase())} — Question of the Day</b>${topic}\n\n` +
    limitText(question, 3800)
  );
}

export function formatReveal(q, expanded = false) {
  const options = [q.option1, q.option2, q.option3, q.option4];
  const i = q.correct_option - 1;
  const answer =
    `<b>✔️ Correct answer:</b> ${LETTERS[i]}) ${escapeHtml(options[i])}` +
    (q.explanation
      ? `\n\n<b>💡 Explanation</b>\n${escapeHtml(q.explanation)}`
      : "");

  if (!expanded) {
    return (
      `<b>🔒 Answer ready</b>\n\n` +
      `<i>The answer and explanation are hidden to keep the chat clean.</i>`
    );
  }

  return `<b>✅ Answer and explanation</b>\n\n${limitText(answer, 3900)}`;
}

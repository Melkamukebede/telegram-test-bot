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

export function revealKeyboard(questionId) {
  return new InlineKeyboard().text("👁 View answer", `view_answer_${questionId}`);
}

export function formatQuestionPost(q, subject) {
  const topic = q.topic ? `\n📖 ${escapeHtml(q.topic)}` : "";
  const hiddenQuestion =
    `${escapeHtml(q.question_text)}\n\n` +
    `A) ${escapeHtml(q.option1)}\n` +
    `B) ${escapeHtml(q.option2)}\n` +
    `C) ${escapeHtml(q.option3)}\n` +
    `D) ${escapeHtml(q.option4)}`;

  return (
    `<b>❓ ${escapeHtml(String(subject).toUpperCase())} — Question of the Day</b>${topic}\n\n` +
    `<tg-spoiler>${limitText(hiddenQuestion, 3800)}</tg-spoiler>\n\n` +
    `<i>Tap the hidden question to open it, then choose your answer.</i>`
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

import { InlineKeyboard } from "grammy";

const LETTERS = ["A", "B", "C", "D"];

// Button data stays numeric (1-4); only the labels students see are letters.
export function answerKeyboard(questionId) {
  return new InlineKeyboard()
    .text("A", `answer_${questionId}_1`).text("B", `answer_${questionId}_2`)
    .row()
    .text("C", `answer_${questionId}_3`).text("D", `answer_${questionId}_4`);
}

export function formatQuestionPost(q, subject) {
  const topic = q.topic ? `\n📖 ${q.topic}` : "";
  return (
    `❓ ${subject.toUpperCase()} — Question of the Day${topic}\n\n${q.question_text}\n\n` +
    `A) ${q.option1}\nB) ${q.option2}\nC) ${q.option3}\nD) ${q.option4}`
  );
}

export function formatReveal(q) {
  const options = [q.option1, q.option2, q.option3, q.option4];
  const i = q.correct_option - 1;
  let msg =
    `✅ Answer Revealed!\n\n❓ ${q.question_text}\n\n` +
    options.map((o, n) => `${LETTERS[n]}) ${o}`).join("\n") +
    `\n\n✔️ Correct Answer: ${LETTERS[i]}) ${options[i]}`;
  if (q.explanation) msg += `\n\n💡 Explanation\n${q.explanation}`;
  return msg.length > 4000 ? msg.slice(0, 3990) + "…" : msg; // Telegram's limit is 4096
}

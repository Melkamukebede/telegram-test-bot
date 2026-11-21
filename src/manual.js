export const MANUAL_SECTIONS = [
  {
    title: "🎓 Student quick start",
    lines: [
      "1. Send /start, then /register.",
      "2. Answer university, major, city, and semester questions.",
      "3. Send /exams to view every available published exam.",
    ],
  },
  {
    title: "📚 Practicing an exam",
    lines: [
      "• Send /exams and choose a published midterm or final exam.",
      "• Four questions appear on each page.",
      "• Choose A, B, C, or D under each question.",
      "• The selected question immediately reveals your choice, correct answer, and explanation.",
      "• Answer all four questions to unlock the next page.",
      "• Your attempt is saved, so /exams can resume an unfinished exam.",
      "• Your final score and percentage appear after the last question.",
    ],
  },
  {
    title: "🗓 Daily channel practice",
    lines: [
      "• Questions are posted at 9:00 AM Addis Ababa time on Tuesday, Friday, Saturday, and Sunday.",
      "• Tap Start today's quiz in the channel card to answer privately.",
      "• Answers and explanations are revealed in the channel at 7:00 PM.",
      "• Use /myinfo for your registration and streak.",
    ],
  },
  {
    title: "🛠 Admin exam upload",
    lines: [
      "1. Send /addquestion, then choose Exam questions or Telegram quiz.",
      "2. Choose Paste text or Upload .txt file.",
      "3. Number questions consecutively from 1.",
      "4. Include A), B), C), D), Answer:, and optional Explanation: lines.",
      "5. The bot confirms the import and shows the added questions.",
      "6. Re-uploading the same exam subject, type, and year replaces that exam safely.",
      "Required headers: Subject, ExamType (Midterm or Final), ExamYear.",
      "Optional headers: ExamTitle, DurationMinutes, Topic.",
    ],
  },
  {
    title: "🧪 Admin testing",
    lines: [
      "• /testquestion — post the daily challenge immediately.",
      "• /testreveal — reveal daily answers immediately.",
      "• /testpromo — test the promotion post.",
      "• /queue — inspect waiting daily questions.",
      "• /poststats — inspect registration numbers.",
      "• /pause and /resume — control scheduled daily posting.",
      "• /setupsteps — show the deployment checklist.",
    ],
  },
  {
    title: "⚙️ Troubleshooting",
    lines: [
      "• If no exams appear, an admin must upload and publish at least one exam.",
      "• If scheduled posts do not run, check Cloudflare deployment, cron triggers, D1 migrations, and /tail logs.",
    ],
  },
];

export function manualMessages(max = 3800) {
  const messages = [];
  let current = "";
  for (const section of MANUAL_SECTIONS) {
    const block = `<b>${section.title}</b>\n${section.lines.join("\n")}`;
    if (current && (current + "\n\n" + block).length > max) {
      messages.push(current);
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current) messages.push(current);
  return messages;
}

import { requireAdmin } from "../auth.js";
import { todayAddis } from "../config.js";
import { parseQuestionFile } from "../services/parser.js";

export function registerUpload(bot, env) {
  bot.on("message:document", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;

    const doc = ctx.message.document;
    if (!doc.file_name || !doc.file_name.toLowerCase().endsWith(".txt")) {
      await ctx.reply("Please send a .txt file (attach it as a File, not a photo).");
      return;
    }
    if (doc.file_size > 1000000) { await ctx.reply("File is too large (max 1 MB)."); return; }

    const file = await ctx.getFile();
    const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
    if (!res.ok) { await ctx.reply("Couldn't download that file. Try sending it again."); return; }

    const { meta, questions, warnings } = parseQuestionFile(await res.text());

    // "TD (Technical Drawing)" -> "td": the key you use in /setplan
    const subject = meta.subject.split("(")[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!subject) { await ctx.reply("I couldn't find a 'Subject:' line in the file header."); return; }
    if (!questions.length) {
      await ctx.reply("No valid questions found.\n" + warnings.slice(0, 5).join("\n"));
      return;
    }

    // Skip questions already stored, so re-uploading a file creates no duplicates
    const existing = await env.DB.prepare("SELECT question_text FROM daily_questions WHERE subject = ?")
      .bind(subject).all();
    const seen = new Set(existing.results.map((r) => r.question_text));

    const batchId = Date.now().toString();
    const statements = [];
    let duplicates = 0;

    for (const q of questions) {
      if (seen.has(q.text)) { duplicates++; continue; }
      seen.add(q.text);
      statements.push(
        env.DB.prepare(
          `INSERT INTO daily_questions
           (subject, grade, topic, question_text, option1, option2, option3, option4,
            correct_option, explanation, batch_id, post_date, is_posted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        ).bind(
          subject, meta.grade, meta.topic, q.text,
          q.options[0], q.options[1], q.options[2], q.options[3],
          q.correct, q.explanation, batchId, todayAddis()
        )
      );
    }

    for (let i = 0; i < statements.length; i += 50) {
      await env.DB.batch(statements.slice(i, i + 50));
    }

    await ctx.reply(
      `✅ Imported ${statements.length} question(s)\n\n` +
        `Subject key: ${subject}\nGrade: ${meta.grade || "-"}\nTopic: ${meta.topic || "-"}\n` +
        `Duplicates skipped: ${duplicates}\nBatch ID: ${batchId}\n` +
        (warnings.length ? `\n⚠️ Warnings:\n${warnings.slice(0, 5).join("\n")}\n` : "") +
        `\nNext: /setplan ${subject} 3`
    );
  });
}

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

    // "TD (Technical Drawing)" -> "td": the stable key used by the exam catalog.
    const subject = meta.subject.split("(")[0].trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!subject) { await ctx.reply("I couldn't find a 'Subject:' line in the file header."); return; }
    if (!questions.length) {
      await ctx.reply("No valid questions found.\n" + warnings.slice(0, 5).join("\n"));
      return;
    }

    const examType = meta.exam_type.toLowerCase();
    const examYear = Number(meta.exam_year);
    if (examType || meta.exam_year || meta.exam_title) {
      if (!["midterm", "final"].includes(examType)) {
        await ctx.reply("Exam uploads need `ExamType: Midterm` or `ExamType: Final`.");
        return;
      }
      if (!Number.isInteger(examYear) || examYear < 2000 || examYear > 2100) {
        await ctx.reply("Exam uploads need a valid `ExamYear:` between 2000 and 2100.");
        return;
      }

      const displayName = meta.subject.includes("(")
        ? meta.subject.slice(meta.subject.indexOf("(") + 1).replace(/\).*$/, "").trim()
        : meta.subject.split("(")[0].trim();
      await env.DB.prepare(
        "INSERT INTO exam_subjects (command, display_name, created_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(command) DO UPDATE SET display_name = excluded.display_name"
      ).bind(subject, displayName || subject.toUpperCase(), new Date().toISOString()).run();
      const catalogSubject = await env.DB.prepare(
        "SELECT id FROM exam_subjects WHERE command = ?"
      ).bind(subject).first();
      const title = meta.exam_title || `${displayName || subject.toUpperCase()} ${examYear} ${examType}`;
      const duration = Number(meta.duration_minutes);
      await env.DB.prepare(
        `INSERT INTO exams
         (subject_id, exam_type, exam_year, title, duration_minutes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(subject_id, exam_type, exam_year) DO UPDATE SET
           title = excluded.title, duration_minutes = excluded.duration_minutes`
      ).bind(
        catalogSubject.id, examType, examYear, title,
        Number.isInteger(duration) && duration > 0 ? duration : 45,
        new Date().toISOString()
      ).run();
      const exam = await env.DB.prepare(
        "SELECT id FROM exams WHERE subject_id = ? AND exam_type = ? AND exam_year = ?"
      ).bind(catalogSubject.id, examType, examYear).first();
      await env.DB.prepare("DELETE FROM exam_questions WHERE exam_id = ?").bind(exam.id).run();
      const statements = questions.map((q, index) => env.DB.prepare(
        `INSERT INTO exam_questions
         (exam_id, question_number, topic, question_text, option1, option2, option3, option4,
          correct_option, explanation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        exam.id, index + 1, meta.topic, q.text,
        q.options[0], q.options[1], q.options[2], q.options[3],
        q.correct, q.explanation, new Date().toISOString()
      ));
      for (let i = 0; i < statements.length; i += 50) {
        await env.DB.batch(statements.slice(i, i + 50));
      }
      await ctx.reply(
        `✅ Imported exam: ${title}\n\n` +
        `Subject key: ${subject}\nType: ${examType}\nYear: ${examYear}\n` +
        `Questions: ${questions.length}\nDuration: ${Number.isInteger(duration) && duration > 0 ? duration : 45} minutes\n` +
        (warnings.length ? `\n⚠️ Warnings:\n${warnings.slice(0, 5).join("\n")}\n` : "")
      );
      return;
    }

    // Skip daily questions already stored, so re-uploading a file creates no duplicates.
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

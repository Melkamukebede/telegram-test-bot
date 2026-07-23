import { Bot, webhookCallback, InlineKeyboard } from "grammy";

function createBot(env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  const UNIVERSITIES = [
    "AAU (Addis Ababa University)", "Adama Science & Technology University",
    "Bahir Dar University", "Mekelle University", "Jimma University",
    "Hawassa University", "Dilla University", "Other",
  ];
  const MAJORS = [
    "Civil Engineering", "Computer Science / Software Engineering",
    "Medicine / Health Sciences", "Business / Economics / Accounting", "Law",
    "Education / Pedagogy", "Nursing", "Electrical Engineering",
    "Mechanical Engineering", "Social Sciences", "Natural Sciences",
    "Mathematics / Statistics", "Other",
  ];
  const CITIES = [
    "Addis Ababa", "Gondar", "Bahir Dar", "Hawassa", "Dire Dawa",
    "Mekelle", "Jimma", "Other",
  ];
  const SEMESTERS = ["Semester 1 (September intake)", "Semester 2 (February intake)"];

  function numberedList(items) {
    return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  }

  function isAdmin(ctx) {
    return ctx.from.id.toString() === env.ADMIN_ID;
  }

  // ================================
  // DB helpers - users
  // ================================
  async function getUser(telegramId) {
    const result = await env.DB.prepare("SELECT * FROM users WHERE telegram_id = ?")
      .bind(telegramId).first();
    return result || null;
  }

  async function upsertUser(telegramId, fields) {
    const existing = await getUser(telegramId);
    if (existing) {
      const keys = Object.keys(fields);
      const setClause = keys.map((k) => `${k} = ?`).join(", ");
      await env.DB.prepare(`UPDATE users SET ${setClause} WHERE telegram_id = ?`)
        .bind(...keys.map((k) => fields[k]), telegramId).run();
    } else {
      const keys = Object.keys(fields);
      const placeholders = keys.map(() => "?").join(", ");
      await env.DB.prepare(
        `INSERT INTO users (telegram_id, ${keys.join(", ")}) VALUES (?, ${placeholders})`
      ).bind(telegramId, ...keys.map((k) => fields[k])).run();
    }
  }

  // ===nnnnnnnnnnnnnnnnnnnnnnn
  function isPrivate(ctx) {
    return ctx.chat.type === "private";
  }

  function isGroup(ctx) {
    return ctx.chat.type === "group" || ctx.chat.type === "supergroup";
  }
  // nnnnnnnnnnnnnnn
  // ================================
  async function getSubject(command) {
    const result = await env.DB.prepare("SELECT * FROM subjects WHERE command = ?")
      .bind(command).first();
    return result || null;
  }

  async function getAllSubjects() {
    const result = await env.DB.prepare("SELECT command, display_name FROM subjects").all();
    return result.results || [];
  }

  // ================================
  // Daily question / leaderboard logic
  // ================================
  async function postDailyQuestion(env, botApi) {
    const question = await env.DB.prepare(
      "SELECT * FROM daily_questions ORDER BY id DESC LIMIT 1"
    ).first();
    if (!question) return;

    const keyboard = new InlineKeyboard()
      .text("1️⃣", `answer_${question.id}_1`).text("2️⃣", `answer_${question.id}_2`)
      .row()
      .text("3️⃣", `answer_${question.id}_3`).text("4️⃣", `answer_${question.id}_4`);

    await botApi.sendMessage(
      env.GROUP_CHAT_ID,
      `❓ Question of the Day\n\n${question.question_text}\n\n` +
        `1. ${question.option1}\n2. ${question.option2}\n3. ${question.option3}\n4. ${question.option4}`,
      { reply_markup: keyboard }
    );
  }

  async function postAnswerReveal(env, botApi) {
    const question = await env.DB.prepare(
      "SELECT * FROM daily_questions ORDER BY id DESC LIMIT 1"
    ).first();
    if (!question) return;

    const correctText = [question.option1, question.option2, question.option3, question.option4][
      question.correct_option - 1
    ];
    await botApi.sendMessage(
      env.GROUP_CHAT_ID,
      `✅ Answer revealed!\n\nCorrect answer: ${question.correct_option}. ${correctText}`
    );
  }

  async function postLeaderboard(env, botApi) {
    const top = await env.DB.prepare(
      "SELECT telegram_id, streak FROM users ORDER BY streak DESC LIMIT 10"
    ).all();

    if (!top.results || top.results.length === 0) {
      await botApi.sendMessage(env.GROUP_CHAT_ID, "No streaks yet this week!");
      return;
    }
    const lines = top.results.map((u, i) => `${i + 1}. User ${u.telegram_id} — 🔥${u.streak}`);
    await botApi.sendMessage(env.GROUP_CHAT_ID, "🏆 Weekly Leaderboard\n\n" + lines.join("\n"));
  }

  // ================================
  // Button menu screens
  // ================================
  function mainMenuScreen() {
    const keyboard = new InlineKeyboard()
      .text("📋 My Info", "screen_info")
      .text("📚 Subjects", "screen_subjects")
      .row()
      .text("🏆 Leaderboard", "show_leaderboard")
      .text("ℹ️ Help", "screen_help");
    return { text: "🎓 Freshman Hub 2026\nWhat would you like to do?", keyboard };
  }

  async function infoScreenFor(telegramId) {
    const user = await getUser(telegramId);
    const keyboard = new InlineKeyboard();

    if (!user || !user.university) {
      keyboard.text("📝 Register Now", "start_register").row();
    }
    keyboard.text("⬅ Back", "main_menu");

    const text =
      !user || !user.university
        ? "You haven't registered yet.\nTap below to get started."
        : `Your Info:\nUniversity: ${user.university}\nMajor: ${user.major}\nCity: ${user.city}\nSemester: ${user.semester}\nStreak: 🔥${user.streak || 0}`;

    return { text, keyboard };
  }

  async function subjectsScreen() {
    const subjects = await getAllSubjects();
    const keyboard = new InlineKeyboard();

    subjects.forEach((s, i) => {
      keyboard.text(s.display_name, `subject_${s.command}`);
      if (i % 2 === 1) keyboard.row();
    });
    keyboard.row().text("⬅ Back", "main_menu");

    return { text: "📚 Pick a subject:", keyboard };
  }

  function helpScreen() {
    const keyboard = new InlineKeyboard().text("⬅ Back", "main_menu");
    return {
      text:
        "Commands:\n" +
        "/menu - open the button menu\n" +
        "/register - start registration\n" +
        "/myinfo - view your saved info\n" +
        "/subjects - list all subjects\n" +
        "/drive - master resource list\n" +
        "/leaderboard - view current leaderboard",
      keyboard,
    };
  }

  // ================================
  // Entry commands
  // ================================
  bot.command("start", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const { text, keyboard } = mainMenuScreen();
    await ctx.reply(`🎓 Welcome to Freshman Hub 2026! 🎓\n\n${text}`, { reply_markup: keyboard });
  });

  bot.command("menu", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const { text, keyboard } = mainMenuScreen();
    await ctx.reply(text, { reply_markup: keyboard });
  });

  bot.command("register", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const telegramId = ctx.from.id.toString();
    await upsertUser(telegramId, { step: "awaiting_university", registered_at: new Date().toISOString() });
    await ctx.reply("Which university will you be attending?\n\nSelect a number:\n" + numberedList(UNIVERSITIES));
  });

  bot.command("myinfo", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const telegramId = ctx.from.id.toString();
    const { text } = await infoScreenFor(telegramId);
    await ctx.reply(text);
  });

  bot.command("subjects", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const subjects = await getAllSubjects();
    if (subjects.length === 0) { await ctx.reply("No subjects added yet."); return; }
    await ctx.reply("📚 Available subjects:\n\n" + subjects.map((s) => `/${s.command} - ${s.display_name}`).join("\n"));
  });

  bot.command("drive", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const subjects = await getAllSubjects();
    await ctx.reply("📂 Master resource list:\n\n" + subjects.map((s) => `${s.display_name}: /${s.command}`).join("\n"));
  });

  bot.command("leaderboard", async (ctx) => {
    await postLeaderboard(env, bot.api);
  });

  bot.command("help", async (ctx) => {
    if (isGroup(ctx)) { // ADD THIS — different reply for group
      await ctx.reply(
        "DM me @Frm2026_bot to:\n" +
        "• Register for Freshman Hub\n" +
        "• Access subject resources\n" +
        "• View your streak and info"
      );
      return;
    }
    // private chat gets the full list
    const { text } = helpScreen();
    await ctx.reply(text);
  });
  // ================================
  // Admin: add daily question
  // Usage: /addquestion Question text | OptionA | OptionB | OptionC | OptionD | 2
  // ================================
  // Usage: /addquestion biology | Question text | OptionA | OptionB | OptionC | OptionD | 2
  bot.command("addquestion", async (ctx) => {
     if (!isPrivate(ctx)) return;
    if (!isAdmin(ctx)) { await ctx.reply("Admins only."); return; }

    const parts = ctx.match.split("|").map((p) => p.trim());
    if (parts.length !== 7) {
      await ctx.reply(
        "Usage:\n/addquestion subject | Question text | OptionA | OptionB | OptionC | OptionD | correct_number(1-4)\n\n" +
        "Example:\n/addquestion biology | What is the powerhouse of the cell? | Nucleus | Mitochondria | Ribosome | Golgi | 2"
      );
      return;
    }

    const [subject, questionText, opt1, opt2, opt3, opt4, correctStr] = parts;
    const correct = parseInt(correctStr);
    if (![1, 2, 3, 4].includes(correct)) { await ctx.reply("Correct option must be 1-4."); return; }

    await env.DB.prepare(
      `INSERT INTO daily_questions (subject, question_text, option1, option2, option3, option4, correct_option, post_date, is_posted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(subject.toLowerCase(), questionText, opt1, opt2, opt3, opt4, correct, new Date().toISOString().split("T")[0]).run();

    await ctx.reply(`Question added under subject "${subject.toLowerCase()}".`);
  });
  bot.command("poststats", async (ctx) => {
     if (!isPrivate(ctx)) return;
    if (!isAdmin(ctx)) { await ctx.reply("This command is for admins only."); return; }
    const total = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
    await ctx.reply(`Total registered users: ${total.count}`);
  });

  // ================================
  // Button navigation (edits message in place)
  bot.command("testquestion", async (ctx) => {
     if (!isPrivate(ctx)) return;
    if (!isAdmin(ctx)) { await ctx.reply("Admins only."); return; }

    const today = new Date().toISOString().split("T")[0];
    const plan = await env.DB.prepare("SELECT * FROM daily_plan WHERE plan_date = ?").bind(today).first();

    if (!plan) { await ctx.reply("No plan set for today. Use /setplan <subject> <count> first."); return; }

    const questions = await env.DB.prepare(
      "SELECT * FROM daily_questions WHERE subject = ? AND is_posted = 0 ORDER BY id ASC LIMIT ?"
    ).bind(plan.subject, plan.question_count).all();

    if (!questions.results || questions.results.length === 0) {
      await ctx.reply(`No unposted questions for "${plan.subject}".`);
      return;
    }

    for (const question of questions.results) {
      const keyboard = new InlineKeyboard()
        .text("1️⃣", `answer_${question.id}_1`).text("2️⃣", `answer_${question.id}_2`)
        .row()
        .text("3️⃣", `answer_${question.id}_3`).text("4️⃣", `answer_${question.id}_4`);

      await bot.api.sendMessage(
        env.GROUP_CHAT_ID,
        `❓ ${plan.subject.toUpperCase()} — Question of the Day\n\n${question.question_text}\n\n` +
          `1. ${question.option1}\n2. ${question.option2}\n3. ${question.option3}\n4. ${question.option4}`,
        { reply_markup: keyboard }
      );

      await env.DB.prepare("UPDATE daily_questions SET is_posted = 1, posted_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), question.id).run();
    }

    await ctx.reply(`Sent ${questions.results.length} question(s) to the group.`);
  });
  // Usage: /setplan biology 3
  bot.command("setplan", async (ctx) => {
     if (!isPrivate(ctx)) return;
     if (!isPrivate(ctx)) return;
    if (!isAdmin(ctx)) { await ctx.reply("Admins only."); return; }

    const parts = ctx.match.trim().split(" ");
    if (parts.length !== 2) {
      await ctx.reply("Usage: /setplan <subject> <count>\nExample: /setplan biology 3");
      return;
    }

    const [subject, countStr] = parts;
    const count = parseInt(countStr);
    if (isNaN(count) || count < 1) { await ctx.reply("Count must be a positive number."); return; }

    const today = new Date().toISOString().split("T")[0];

    await env.DB.prepare(
      `INSERT INTO daily_plan (plan_date, subject, question_count) VALUES (?, ?, ?)
       ON CONFLICT(plan_date) DO UPDATE SET subject = excluded.subject, question_count = excluded.question_count`
    ).bind(today, subject.toLowerCase(), count).run();

    // Check how many unposted questions actually exist for this subject
    const available = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM daily_questions WHERE subject = ? AND is_posted = 0"
    ).bind(subject.toLowerCase()).first();

    await ctx.reply(
      `Plan set: ${count} question(s) on "${subject.toLowerCase()}" today.\n` +
      `Available unposted questions in this subject: ${available.count}`
    );
  });
  // ================================
  bot.callbackQuery("main_menu", async (ctx) => {
    const { text, keyboard } = mainMenuScreen();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  bot.callbackQuery("screen_info", async (ctx) => {
    const { text, keyboard } = await infoScreenFor(ctx.from.id.toString());
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  bot.callbackQuery("screen_subjects", async (ctx) => {
    const { text, keyboard } = await subjectsScreen();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  bot.callbackQuery("screen_help", async (ctx) => {
    const { text, keyboard } = helpScreen();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  bot.callbackQuery("show_leaderboard", async (ctx) => {
    await ctx.answerCallbackQuery();
    await postLeaderboard(env, bot.api);
  });

  bot.callbackQuery("start_register", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    await upsertUser(telegramId, { step: "awaiting_university", registered_at: new Date().toISOString() });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      "Which university will you be attending?\n\nReply with a number:\n" + numberedList(UNIVERSITIES),
      { reply_markup: new InlineKeyboard().text("⬅ Back", "main_menu") }
    );
  });

  bot.callbackQuery(/^subject_(.+)$/, async (ctx) => {
    const command = ctx.match[1];
    const subject = await getSubject(command);
    await ctx.answerCallbackQuery();

    if (!subject) { await ctx.editMessageText("That subject wasn't found."); return; }

    await ctx.editMessageText(`📖 ${subject.display_name}\n\n${subject.drive_link}`, {
      reply_markup: new InlineKeyboard().text("⬅ Back", "screen_subjects"),
    });
  });

  // ================================
  // Daily question answer buttons
  // ================================
  bot.callbackQuery(/^answer_(\d+)_(\d)$/, async (ctx) => {
    const [, questionId, selected] = ctx.match;
    const telegramId = ctx.from.id.toString();

    const question = await env.DB.prepare("SELECT * FROM daily_questions WHERE id = ?")
      .bind(questionId).first();

    const alreadyAnswered = await env.DB.prepare(
      "SELECT * FROM answers WHERE telegram_id = ? AND question_id = ?"
    ).bind(telegramId, questionId).first();

    if (alreadyAnswered) { await ctx.answerCallbackQuery({ text: "You already answered this one." }); return; }

    const isCorrect = parseInt(selected) === question.correct_option;

    await env.DB.prepare(
      "INSERT INTO answers (telegram_id, question_id, selected_option, is_correct, answered_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(telegramId, questionId, selected, isCorrect ? 1 : 0, new Date().toISOString()).run();

    if (isCorrect) {
      await env.DB.prepare("UPDATE users SET streak = streak + 1, last_answered_date = ? WHERE telegram_id = ?")
        .bind(new Date().toISOString().split("T")[0], telegramId).run();
    }

    await ctx.answerCallbackQuery({
      text: isCorrect ? "Correct! 🔥 Streak +1" : "Not quite — see you at 2 PM for the answer.",
    });
  });

  // ================================
  // Subject text commands (/logic, /physics, etc.) - checked before registration flow
  // ================================
  bot.on("message:text", async (ctx, next) => {
     if (!isPrivate(ctx)) { await next(); return; } 
    const text = ctx.message.text.trim();
    if (!text.startsWith("/")) { await next(); return; }

    const command = text.slice(1).toLowerCase();
    const subject = await getSubject(command);

    if (subject) { await ctx.reply(`📖 ${subject.display_name}\n\n${subject.drive_link}`); return; }
    await next();
  });

  // ================================
  // Registration flow (multi-step) - must be the LAST message:text handler
  // ================================
  bot.on("message:text", async (ctx) => {
     if (!isPrivate(ctx)) return;
    const telegramId = ctx.from.id.toString();
    const text = ctx.message.text.trim();
    const user = await getUser(telegramId);

    if (!user || !user.step) {
      await ctx.reply("Type /register to get started, or /menu for options.");
      return;
    }

    if (user.step === "awaiting_university") {
      const index = parseInt(text) - 1;
      const value = index >= 0 && index < UNIVERSITIES.length - 1 ? UNIVERSITIES[index] : text;
      await upsertUser(telegramId, { university: value, step: "awaiting_major" });
      await ctx.reply("📚 What is your intended major?\n\nSelect a number:\n" + numberedList(MAJORS));
      return;
    }

    if (user.step === "awaiting_major") {
      const index = parseInt(text) - 1;
      const value = index >= 0 && index < MAJORS.length - 1 ? MAJORS[index] : text;
      await upsertUser(telegramId, { major: value, step: "awaiting_city" });
      await ctx.reply("📍 Which city are you currently in?\n\nSelect a number:\n" + numberedList(CITIES));
      return;
    }

    if (user.step === "awaiting_city") {
      const index = parseInt(text) - 1;
      const value = index >= 0 && index < CITIES.length - 1 ? CITIES[index] : text;
      await upsertUser(telegramId, { city: value, step: "awaiting_semester" });
      await ctx.reply("📅 Which semester are you starting?\n\nSelect a number:\n" + numberedList(SEMESTERS));
      return;
    }

    if (user.step === "awaiting_semester") {
      const index = parseInt(text) - 1;
      const value = index >= 0 && index < SEMESTERS.length ? SEMESTERS[index] : text;
      await upsertUser(telegramId, { semester: value, step: null });

      const finalUser = await getUser(telegramId);
      await ctx.reply(
        "✅ Registration Complete!\n\n" +
          `University: ${finalUser.university}\nMajor: ${finalUser.major}\n` +
          `City: ${finalUser.city}\nSemester: ${finalUser.semester}\n\n` +
          "You'll get daily questions starting tomorrow at 8:00 AM. Welcome! 🚀"
      );
      return;
    }

    await ctx.reply("Something went off track — type /register to start over.");
  });

  return bot;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response("Freshman Hub bot is running.", { status: 200 });
    }
    const bot = createBot(env);
    const handleUpdate = webhookCallback(bot, "cloudflare-mod");
    try {
      return await handleUpdate(request);
    } catch (err) {
      console.error("Error handling update:", err);
      return new Response("Error", { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
    const hour = new Date(event.scheduledTime).getUTCHours();
    const day = new Date(event.scheduledTime).getUTCDay(); // 0 = Sunday

    if (hour === 5) {
      const today = new Date().toISOString().split("T")[0];
      const plan = await env.DB.prepare("SELECT * FROM daily_plan WHERE plan_date = ?").bind(today).first();

      if (!plan) {
        console.log("No plan set for today — skipping daily post.");
      } else {
        const questions = await env.DB.prepare(
          "SELECT * FROM daily_questions WHERE subject = ? AND is_posted = 0 ORDER BY id ASC LIMIT ?"
        ).bind(plan.subject, plan.question_count).all();

        if (!questions.results || questions.results.length === 0) {
          await bot.api.sendMessage(env.GROUP_CHAT_ID, `No unposted questions left for subject "${plan.subject}" today.`);
        } else {
          for (const question of questions.results) {
            const keyboard = new InlineKeyboard()
              .text("1️⃣", `answer_${question.id}_1`).text("2️⃣", `answer_${question.id}_2`)
              .row()
              .text("3️⃣", `answer_${question.id}_3`).text("4️⃣", `answer_${question.id}_4`);

            await bot.api.sendMessage(
              env.GROUP_CHAT_ID,
              `❓ ${plan.subject.toUpperCase()} — Question of the Day\n\n${question.question_text}\n\n` +
                `1. ${question.option1}\n2. ${question.option2}\n3. ${question.option3}\n4. ${question.option4}`,
              { reply_markup: keyboard }
            );

            await env.DB.prepare("UPDATE daily_questions SET is_posted = 1, posted_at = ? WHERE id = ?")
              .bind(new Date().toISOString(), question.id).run();
          }
        }
      }
    } else if (hour === 11) {
      const question = await env.DB.prepare("SELECT * FROM daily_questions ORDER BY id DESC LIMIT 1").first();
      if (question) {
        const correctText = [question.option1, question.option2, question.option3, question.option4][question.correct_option - 1];
        await bot.api.sendMessage(env.GROUP_CHAT_ID, `✅ Answer revealed!\n\nCorrect answer: ${question.correct_option}. ${correctText}`);
      }
    } else if (hour === 15 && day === 0) {
      const top = await env.DB.prepare("SELECT telegram_id, streak FROM users ORDER BY streak DESC LIMIT 10").all();
      if (top.results && top.results.length > 0) {
        const lines = top.results.map((u, i) => `${i + 1}. User ${u.telegram_id} — 🔥${u.streak}`);
        await bot.api.sendMessage(env.GROUP_CHAT_ID, "🏆 Weekly Leaderboard\n\n" + lines.join("\n"));
      }
    }
  },
};

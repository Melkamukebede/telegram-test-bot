import { Bot, webhookCallback, InlineKeyboard } from "grammy";

function createBot(env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  const UNIVERSITIES = [
    "AAU (Addis Ababa University)",
    "Adama Science & Technology University",
    "Bahir Dar University",
    "Mekelle University",
    "Jimma University",
    "Hawassa University",
    "Dilla University",
    "Other",
  ];

  const MAJORS = [
    "Civil Engineering",
    "Computer Science / Software Engineering",
    "Medicine / Health Sciences",
    "Business / Economics / Accounting",
    "Law",
    "Education / Pedagogy",
    "Nursing",
    "Electrical Engineering",
    "Mechanical Engineering",
    "Social Sciences",
    "Natural Sciences",
    "Mathematics / Statistics",
    "Other",
  ];

  const CITIES = [
    "Addis Ababa",
    "Gondar",
    "Bahir Dar",
    "Hawassa",
    "Dire Dawa",
    "Mekelle",
    "Jimma",
    "Other",
  ];

  const SEMESTERS = ["Semester 1 (September intake)", "Semester 2 (February intake)"];

  // ================================
  // newooooooooooooooo
  // ================================
  // Subject resources
  // ================================
  async function getSubject(command) {
    const result = await env.DB.prepare("SELECT * FROM subjects WHERE command = ?")
      .bind(command)
      .first();
    return result || null;
  }

  async function getAllSubjects() {
    const result = await env.DB.prepare("SELECT command, display_name FROM subjects").all();
    return result.results || [];
  }

  bot.command("subjects", async (ctx) => {
    const subjects = await getAllSubjects();
    if (subjects.length === 0) {
      await ctx.reply("No subjects have been added yet.");
      return;
    }
    const lines = subjects.map((s) => `/${s.command} - ${s.display_name}`);
    await ctx.reply("📚 Available subjects:\n\n" + lines.join("\n"));
  });

  bot.command("drive", async (ctx) => {
    const subjects = await getAllSubjects();
    await ctx.reply(
      "📂 Master resource list:\n\n" +
        subjects.map((s) => `${s.display_name}: use /${s.command}`).join("\n")
    );
  });

  // Generic handler: catches /logic, /math, /physics, etc.
  // by checking if the typed command matches a row in the subjects table.
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (!text.startsWith("/")) {
      await next(); // not a command, let other handlers (registration flow) process it
      return;
    }

    const command = text.slice(1).toLowerCase();
    const subject = await getSubject(command);

    if (subject) {
      await ctx.reply(`📖 ${subject.display_name}\n\n${subject.drive_link}`);
      return;
    }

    await next(); // not a known subject command, pass to other handlers
  });
  ///nweooooooooooooooooo
  // ================================
  async function getUser(telegramId) {
    const result = await env.DB.prepare("SELECT * FROM users WHERE telegram_id = ?")
      .bind(telegramId)
      .first();
    return result || null;
  }

  async function upsertUser(telegramId, fields) {
    const existing = await getUser(telegramId);
    if (existing) {
      const keys = Object.keys(fields);
      const setClause = keys.map((k) => `${k} = ?`).join(", ");
      await env.DB.prepare(`UPDATE users SET ${setClause} WHERE telegram_id = ?`)
        .bind(...keys.map((k) => fields[k]), telegramId)
        .run();
    } else {
      const keys = Object.keys(fields);
      const placeholders = keys.map(() => "?").join(", ");
      await env.DB.prepare(
        `INSERT INTO users (telegram_id, ${keys.join(", ")}) VALUES (?, ${placeholders})`
      )
        .bind(telegramId, ...keys.map((k) => fields[k]))
        .run();
    }
  }

  function numberedList(items) {
    return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  }

  // ================================
  // Registration flow
  // ================================
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "🎓 Welcome to Freshman Hub 2026! 🎓\n\n" +
        "I'll ask you 4 quick questions to set you up. Type /register when you're ready."
    );
  });

  bot.command("register", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    await upsertUser(telegramId, { step: "awaiting_university", registered_at: new Date().toISOString() });

    await ctx.reply(
      "Which university will you be attending?\n\nSelect a number:\n" + numberedList(UNIVERSITIES)
    );
  });

  bot.on("message:text", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const text = ctx.message.text.trim();
    const user = await getUser(telegramId);

    if (!user || !user.step) {
      await ctx.reply("Type /register to get started, or /help for commands.");
      return;
    }

    // --- Step: university ---
    if (user.step === "awaiting_university") {
      const index = parseInt(text) - 1;
      const value =
        index >= 0 && index < UNIVERSITIES.length - 1
          ? UNIVERSITIES[index]
          : text; // "Other" or free text fallback

      await upsertUser(telegramId, { university: value, step: "awaiting_major" });
      await ctx.reply("📚 What is your intended major or field of study?\n\nSelect a number:\n" + numberedList(MAJORS));
      return;
    }

    // --- Step: major ---
    if (user.step === "awaiting_major") {
      const index = parseInt(text) - 1;
      const value = index >= 0 && index < MAJORS.length - 1 ? MAJORS[index] : text;

      await upsertUser(telegramId, { major: value, step: "awaiting_city" });
      await ctx.reply("📍 Which city are you currently in?\n\nSelect a number:\n" + numberedList(CITIES));
      return;
    }

    // --- Step: city ---
    if (user.step === "awaiting_city") {
      const index = parseInt(text) - 1;
      const value = index >= 0 && index < CITIES.length - 1 ? CITIES[index] : text;

      await upsertUser(telegramId, { city: value, step: "awaiting_semester" });
      await ctx.reply("📅 Which semester are you starting?\n\nSelect a number:\n" + numberedList(SEMESTERS));
      return;
    }

    // --- Step: semester (final step) ---
    if (user.step === "awaiting_semester") {
      const index = parseInt(text) - 1;
      const value = index >= 0 && index < SEMESTERS.length ? SEMESTERS[index] : text;

      await upsertUser(telegramId, { semester: value, step: null });

      const finalUser = await getUser(telegramId);
      await ctx.reply(
        "✅ Registration Complete!\n\n" +
          `University: ${finalUser.university}\n` +
          `Major: ${finalUser.major}\n` +
          `City: ${finalUser.city}\n` +
          `Semester: ${finalUser.semester}\n\n` +
          "You'll get daily questions starting tomorrow at 8:00 AM. Welcome to Freshman Hub 2026! 🚀"
      );
      return;
    }

    // Fallback if step is something unexpected
    await ctx.reply("Something went off track — type /register to start over.");
  });

  bot.command("myinfo", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await getUser(telegramId);

    if (!user || !user.university) {
      await ctx.reply("You haven't registered yet. Type /register to get started.");
      return;
    }

    await ctx.reply(
      `University: ${user.university}\nMajor: ${user.major}\nCity: ${user.city}\nSemester: ${user.semester}\nStreak: ${user.streak || 0}`
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("/register - start registration\n/myinfo - view your saved info");
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
};

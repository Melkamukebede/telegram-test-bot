import { Bot, webhookCallback } from "grammy";

function createBot(env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // ================================
  // Helpers for structured storage
  // ================================
  async function getUserData(userId) {
    const raw = await env.USER_INFO.get(userId);
    return raw ? JSON.parse(raw) : {};
  }

  async function saveUserData(userId, data) {
    await env.USER_INFO.put(userId, JSON.stringify(data));
  }

  // ================================
  // Basic commands
  // ================================
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hey! I'm a test bot running on Cloudflare Workers.\n\nTry /help to see everything I can do."
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Commands:\n" +
        "/set <field> <value> - save a field, e.g. /set name Melkamu\n" +
        "/get <field> - show one saved field\n" +
        "/myinfo - show everything saved\n" +
        "/deleteinfo - erase a field, or everything\n" +
        "/echo <text> - I repeat it back\n" +
        "/time - current UTC time\n" +
        "/joke - a random programming joke\n" +
        "/roll - roll a dice (1-6)\n" +
        "/flip - flip a coin"
    );
  });

  // ================================
  // Structured saved info (multiple fields per user)
  // ================================
  bot.command("set", async (ctx) => {
    const userId = ctx.from.id.toString();
    const input = ctx.match.trim();

    if (!input) {
      await ctx.reply("Usage: /set <field> <value>\nExample: /set name Melkamu");
      return;
    }

    const spaceIndex = input.indexOf(" ");
    if (spaceIndex === -1) {
      await ctx.reply("Please include a value too.\nExample: /set name Melkamu");
      return;
    }

    const field = input.slice(0, spaceIndex).toLowerCase();
    const value = input.slice(spaceIndex + 1);

    const data = await getUserData(userId);
    data[field] = value;
    await saveUserData(userId, data);

    await ctx.reply(`Saved: ${field} = ${value}`);
  });

  bot.command("get", async (ctx) => {
    const userId = ctx.from.id.toString();
    const field = ctx.match.trim().toLowerCase();

    if (!field) {
      await ctx.reply("Usage: /get <field>\nExample: /get name");
      return;
    }

    const data = await getUserData(userId);
    await ctx.reply(
      data[field] !== undefined
        ? `${field}: ${data[field]}`
        : `Nothing saved for "${field}" yet. Try /set ${field} <value>`
    );
  });

  bot.command("myinfo", async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = await getUserData(userId);
    const fields = Object.keys(data);

    if (fields.length === 0) {
      await ctx.reply("You haven't saved anything yet. Try /set name Melkamu");
      return;
    }

    const lines = fields.map((key) => `${key}: ${data[key]}`);
    await ctx.reply("Here's everything I have saved:\n" + lines.join("\n"));
  });

  bot.command("deleteinfo", async (ctx) => {
    const userId = ctx.from.id.toString();
    const field = ctx.match.trim().toLowerCase();

    const data = await getUserData(userId);

    if (!field) {
      // No field specified - wipe everything
      await env.USER_INFO.delete(userId);
      await ctx.reply("Done — I've erased everything saved for you.");
      return;
    }

    if (data[field] === undefined) {
      await ctx.reply(`Nothing saved under "${field}".`);
      return;
    }

    delete data[field];
    await saveUserData(userId, data);
    await ctx.reply(`Deleted "${field}".`);
  });

  // ================================
  // Utility / fun commands
  // ================================
  bot.command("echo", async (ctx) => {
    const text = ctx.match;
    await ctx.reply(text.length > 0 ? text : "Usage: /echo your message here");
  });

  bot.command("time", async (ctx) => {
    await ctx.reply(`Current UTC time: ${new Date().toISOString()}`);
  });

  bot.command("joke", async (ctx) => {
    const jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "There are 10 types of people: those who understand binary, and those who don't.",
      "Why do Java developers wear glasses? Because they don't C#.",
      "A SQL query walks into a bar, sees two tables, and asks: 'Can I join you?'",
      "I would tell you a UDP joke, but you might not get it.",
    ];
    const pick = jokes[Math.floor(Math.random() * jokes.length)];
    await ctx.reply(pick);
  });

  bot.command("roll", async (ctx) => {
    const roll = Math.floor(Math.random() * 6) + 1;
    await ctx.reply(`🎲 You rolled a ${roll}`);
  });

  bot.command("flip", async (ctx) => {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    await ctx.reply(`🪙 ${result}`);
  });

  // ================================
  // Plain text fallback
  // ================================
  bot.on("message:text", async (ctx) => {
    await ctx.reply(`You said: "${ctx.message.text}"`);
  });

  return bot;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response("Telegram bot Worker is running.", { status: 200 });
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

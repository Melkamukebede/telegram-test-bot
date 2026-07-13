import { Bot, webhookCallback } from "grammy";

// The bot instance is created fresh per-request using the token from
// the environment, since Cloudflare Workers don't share global state
// reliably across invocations the way a normal Node process would.
function createBot(env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // ================================
  // Basic commands
  // ================================
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hey! I'm a test bot running on Cloudflare Workers.\n\n" +
        "Try /help to see everything I can do."
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Commands:\n" +
        "/setinfo - save some info about yourself\n" +
        "/myinfo - show what I have saved\n" +
        "/deleteinfo - erase your saved info\n" +
        "/echo <text> - I repeat it back\n" +
        "/time - current UTC time\n" +
        "/joke - a random programming joke\n" +
        "/roll - roll a dice (1-6)\n" +
        "/flip - flip a coin\n" +
        "/cancel - cancel a pending /setinfo request"
    );
  });

  // ================================
  // Saved info (KV storage) - multi-step flow
  // ================================
  bot.command("setinfo", async (ctx) => {
    const info = ctx.match;
    const userId = ctx.from.id.toString();

    if (info) {
      // One-liner style still works: /setinfo some text
      await env.USER_INFO.put(userId, info);
      await ctx.reply("Saved! I'll remember that.");
      return;
    }

    // No text after the command - wait for their next message
    await env.USER_INFO.put(`awaiting:${userId}`, "true");
    await ctx.reply("Sure — send me the info you want me to save. (Or /cancel to stop.)");
  });

  bot.command("myinfo", async (ctx) => {
    const userId = ctx.from.id.toString();
    const stored = await env.USER_INFO.get(userId);
    await ctx.reply(
      stored
        ? `Here's what I have saved: ${stored}`
        : "I don't have anything saved for you yet. Try /setinfo first."
    );
  });

  bot.command("deleteinfo", async (ctx) => {
    const userId = ctx.from.id.toString();
    const existing = await env.USER_INFO.get(userId);

    if (!existing) {
      await ctx.reply("There's nothing saved to delete.");
      return;
    }

    await env.USER_INFO.delete(userId);
    await ctx.reply("Done — I've erased your saved info.");
  });

  bot.command("cancel", async (ctx) => {
    const userId = ctx.from.id.toString();
    await env.USER_INFO.delete(`awaiting:${userId}`);
    await ctx.reply("Cancelled. Nothing was saved.");
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
  // Plain text fallback (checks if we're mid-/setinfo flow first)
  // ================================
  bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id.toString();
    const isAwaiting = await env.USER_INFO.get(`awaiting:${userId}`);

    if (isAwaiting) {
      await env.USER_INFO.put(userId, ctx.message.text);
      await env.USER_INFO.delete(`awaiting:${userId}`);
      await ctx.reply("Got it — saved! Check anytime with /myinfo.");
      return;
    }

    await ctx.reply(`You said: "${ctx.message.text}"`);
  });

  return bot;
}

export default {
  async fetch(request, env, ctx) {
    // Simple GET route so you can confirm the Worker is alive
    // by visiting the URL directly in a browser.
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

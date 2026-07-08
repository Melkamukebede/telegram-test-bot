import { Bot, webhookCallback } from "grammy";

// The bot instance is created fresh per-request using the token from
// the environment, since Cloudflare Workers don't share global state
// reliably across invocations the way a normal Node process would.
function createBot(env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // --- Commands ---
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hey! I'm a test bot running on Cloudflare Workers.\n\n" +
        "Try:\n/help - list commands\n/echo <text> - I repeat it back\n/time - current server time"
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Commands:\n/start - intro message\n/echo <text> - echoes your text\n/time - shows current UTC time"
    );
  });

  bot.command("echo", async (ctx) => {
    const text = ctx.match; // everything after "/echo "
    await ctx.reply(text.length > 0 ? text : "Usage: /echo your message here");
  });

  bot.command("time", async (ctx) => {
    await ctx.reply(`Current UTC time: ${new Date().toISOString()}`);
  });
bot.command("setinfo", async (ctx) => {
  const info = ctx.match;
  if (!info) {
    await ctx.reply("Usage: /setinfo your text here");
    return;
  }
  const userId = ctx.from.id.toString();
  await env.USER_INFO.put(userId, info);
  await ctx.reply("Saved! I'll remember that.");
});

bot.command("myinfo", async (ctx) => {
  const userId = ctx.from.id.toString();
  const stored = await env.USER_INFO.get(userId);
  await ctx.reply(stored ? `Here's what I have saved: ${stored}` : "I don't have anything saved for you yet. Try /setinfo first.");
});
  // --- Plain text fallback (non-command messages) ---
  bot.on("message:text", async (ctx) => {
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

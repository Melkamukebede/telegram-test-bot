import { Bot, webhookCallback, InlineKeyboard } from "grammy";

function createBot(env) {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // ================================
  // Storage helpers
  // ================================
  async function getUserData(userId) {
    const raw = await env.USER_INFO.get(userId);
    return raw ? JSON.parse(raw) : {};
  }

  async function saveUserData(userId, data) {
    await env.USER_INFO.put(userId, JSON.stringify(data));
  }

  const JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "There are 10 types of people: those who understand binary, and those who don't.",
    "Why do Java developers wear glasses? Because they don't C#.",
    "A SQL query walks into a bar, sees two tables, and asks: 'Can I join you?'",
    "I would tell you a UDP joke, but you might not get it.",
  ];

  // ================================
  // Screens (each returns {text, keyboard})
  // ================================
  function mainMenuScreen() {
    const keyboard = new InlineKeyboard()
      .text("📋 Info", "screen_info")
      .text("🎉 Fun", "screen_fun")
      .row()
      .text("ℹ️ Help", "screen_help");
    return { text: "Main Menu\nWhat would you like to do?", keyboard };
  }

  function infoScreen() {
    const keyboard = new InlineKeyboard()
      .text("View My Info", "myinfo")
      .row()
      .text("Delete My Info", "deleteinfo")
      .row()
      .text("⬅ Back", "main_menu");
    return {
      text: "Info Menu\nUse /set <field> <value> to save something (e.g. /set name Melkamu), then view or delete it below.",
      keyboard,
    };
  }

  function funScreen() {
    const keyboard = new InlineKeyboard()
      .text("🎲 Roll Dice", "roll")
      .text("🪙 Flip Coin", "flip")
      .row()
      .text("😂 Joke", "joke")
      .text("🕐 Time", "time")
      .row()
      .text("⬅ Back", "main_menu");
    return { text: "Fun Menu\nPick something:", keyboard };
  }

  function helpScreen() {
    const keyboard = new InlineKeyboard().text("⬅ Back", "main_menu");
    return {
      text:
        "Commands:\n" +
        "/menu - open the button menu\n" +
        "/set <field> <value> - save a field\n" +
        "/get <field> - show one saved field\n" +
        "/myinfo - show everything saved\n" +
        "/deleteinfo [field] - erase a field, or everything\n" +
        "/echo <text> - I repeat it back",
      keyboard,
    };
  }

  // ================================
  // Entry commands
  // ================================
  bot.command("start", async (ctx) => {
    const { text, keyboard } = mainMenuScreen();
    await ctx.reply(`Hey! I'm a test bot running on Cloudflare Workers.\n\n${text}`, {
      reply_markup: keyboard,
    });
  });

  bot.command("menu", async (ctx) => {
    const { text, keyboard } = mainMenuScreen();
    await ctx.reply(text, { reply_markup: keyboard });
  });

  bot.command("help", async (ctx) => {
    const { text, keyboard } = helpScreen();
    await ctx.reply(text, { reply_markup: keyboard });
  });

  // ================================
  // Screen navigation (edits the same message in place)
  // ================================
  bot.callbackQuery("main_menu", async (ctx) => {
    const { text, keyboard } = mainMenuScreen();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  bot.callbackQuery("screen_info", async (ctx) => {
    const { text, keyboard } = infoScreen();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  bot.callbackQuery("screen_fun", async (ctx) => {
    const { text, keyboard } = funScreen();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  bot.callbackQuery("screen_help", async (ctx) => {
    const { text, keyboard } = helpScreen();
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { reply_markup: keyboard });
  });

  // ================================
  // Actions (stay on the Info screen, editing in place)
  // ================================
  bot.callbackQuery("myinfo", async (ctx) => {
    const userId = ctx.from.id.toString();
    const data = await getUserData(userId);
    const fields = Object.keys(data);

    const body =
      fields.length === 0
        ? "You haven't saved anything yet.\nTry /set name Melkamu"
        : "Your saved info:\n" + fields.map((k) => `${k}: ${data[k]}`).join("\n");

    const keyboard = new InlineKeyboard().text("⬅ Back", "screen_info");
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(body, { reply_markup: keyboard });
  });

  bot.callbackQuery("deleteinfo", async (ctx) => {
    const userId = ctx.from.id.toString();
    await env.USER_INFO.delete(userId);

    const keyboard = new InlineKeyboard().text("⬅ Back", "screen_info");
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Done — everything saved for you has been erased.", {
      reply_markup: keyboard,
    });
  });

  // ================================
  // Actions (stay on the Fun screen, editing in place)
  // ================================
  bot.callbackQuery("roll", async (ctx) => {
    const roll = Math.floor(Math.random() * 6) + 1;
    const keyboard = new InlineKeyboard().text("⬅ Back", "screen_fun");
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`🎲 You rolled a ${roll}`, { reply_markup: keyboard });
  });

  bot.callbackQuery("flip", async (ctx) => {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    const keyboard = new InlineKeyboard().text("⬅ Back", "screen_fun");
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`🪙 ${result}`, { reply_markup: keyboard });
  });

  bot.callbackQuery("joke", async (ctx) => {
    const pick = JOKES[Math.floor(Math.random() * JOKES.length)];
    const keyboard = new InlineKeyboard().text("⬅ Back", "screen_fun");
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(pick, { reply_markup: keyboard });
  });

  bot.callbackQuery("time", async (ctx) => {
    const keyboard = new InlineKeyboard().text("⬅ Back", "screen_fun");
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`Current UTC time: ${new Date().toISOString()}`, {
      reply_markup: keyboard,
    });
  });

  // ================================
  // Text-based commands (unchanged, still work alongside buttons)
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

  bot.command("echo", async (ctx) => {
    const text = ctx.match;
    await ctx.reply(text.length > 0 ? text : "Usage: /echo your message here");
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

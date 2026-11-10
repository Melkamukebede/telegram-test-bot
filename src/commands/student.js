import { InlineKeyboard } from "grammy";
import { isPrivate, isGroup, isAdmin, roleOf } from "../auth.js";
import { startRegistration } from "../db.js";
import { questionText, BRAND, SINAHARD_URL } from "../config.js";
import { mainMenuScreen, infoScreen, helpScreen } from "../screens.js";
import { postLeaderboard } from "../services/scheduler.js";
import { syncMenuFor } from "../services/menu.js";

const botName = (ctx) => (ctx.me?.username ? `@${ctx.me.username}` : "the bot");

export function registerStudentCommands(bot, env) {
  bot.command("start", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const { text, keyboard } = mainMenuScreen();
    await ctx.reply(`🎓 Welcome to ${BRAND}!\n\n${text}`, { reply_markup: keyboard });

    // Owner and admins get the extended "/" menu in their own chat
    const role = await roleOf(ctx, env);
    if (role !== "student") await syncMenuFor(bot.api, ctx.from.id, role);
  });

  bot.command("menu", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const { text, keyboard } = mainMenuScreen();
    await ctx.reply(text, { reply_markup: keyboard });
  });

  bot.command("register", async (ctx) => {
    if (!isPrivate(ctx)) {
      await ctx.reply(`Please DM ${botName(ctx)} to register.`);
      return;
    }
    await startRegistration(env, String(ctx.from.id), ctx.from.first_name);
    await ctx.reply(questionText(0));
  });

  bot.command("myinfo", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const { text } = await infoScreen(env, String(ctx.from.id));
    await ctx.reply(text);
  });

  // Works everywhere, including groups
  bot.command("app", async (ctx) => {
    await ctx.reply(
      `🚀 ${BRAND}: practice tests and exam prep. Works offline.\n\n${SINAHARD_URL}`,
      { reply_markup: new InlineKeyboard().url("Open Sinahard", SINAHARD_URL) }
    );
  });

  bot.command("leaderboard", async (ctx) => {
    if (!(await isAdmin(ctx, env))) {
      if (isPrivate(ctx)) await ctx.reply("Admins only.");
      return;
    }
    await postLeaderboard(env, bot.api);
    if (isPrivate(ctx)) await ctx.reply("Leaderboard posted to the channel.");
  });

  bot.command("help", async (ctx) => {
    if (isGroup(ctx)) {
      await ctx.reply(
        `DM ${botName(ctx)} to:\n• Register\n• See your streak and info\n• Get the ${BRAND} app link with /app`
      );
      return;
    }
    const role = isPrivate(ctx) ? await roleOf(ctx, env) : "student";
    const { text, keyboard } = helpScreen(role);
    await ctx.reply(text, { reply_markup: keyboard });
    if (role !== "student") await syncMenuFor(bot.api, ctx.from.id, role);
  });
}

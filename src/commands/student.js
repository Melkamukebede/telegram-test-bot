import { isPrivate, isGroup } from "../auth.js";
import { getAllSubjects, getSubject, startRegistration } from "../db.js";
import { questionText } from "../config.js";
import { mainMenuScreen, infoScreen, helpScreen } from "../screens.js";
import { postLeaderboard } from "../services/scheduler.js";

const botName = (ctx) => (ctx.me?.username ? `@${ctx.me.username}` : "the bot");

export function registerStudentCommands(bot, env) {
  bot.command("start", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const { text, keyboard } = mainMenuScreen();
    await ctx.reply(`🎓 Welcome to Freshman Hub 2026!\n\n${text}`, { reply_markup: keyboard });
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
    await startRegistration(env, String(ctx.from.id));
    await ctx.reply(questionText(0));
  });

  bot.command("myinfo", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const { text } = await infoScreen(env, String(ctx.from.id));
    await ctx.reply(text);
  });

  bot.command("subjects", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const subjects = await getAllSubjects(env);
    if (!subjects.length) { await ctx.reply("No subjects added yet."); return; }
    await ctx.reply("📚 Available subjects:\n\n" + subjects.map((s) => `/${s.command} - ${s.display_name}`).join("\n"));
  });

  bot.command("drive", async (ctx) => {
    if (!isPrivate(ctx)) return;
    const subjects = await getAllSubjects(env);
    await ctx.reply("📂 Master resource list:\n\n" + subjects.map((s) => `${s.display_name}: /${s.command}`).join("\n"));
  });

  bot.command("leaderboard", async (ctx) => {
    await postLeaderboard(env, bot.api);
    if (isPrivate(ctx)) await ctx.reply("Leaderboard posted to the group.");
  });

  bot.command("help", async (ctx) => {
    if (isGroup(ctx)) {
      await ctx.reply(
        `DM ${botName(ctx)} to:\n• Register for Freshman Hub\n• Get subject resources\n• See your streak and info`
      );
      return;
    }
    const { text, keyboard } = helpScreen();
    await ctx.reply(text, { reply_markup: keyboard });
  });
}

// Handles /logic, /physics, ... (any command that exists in the subjects table).
// Register it AFTER all real commands and BEFORE the registration flow.
export function registerSubjectCatcher(bot, env) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (!isPrivate(ctx) || !text.startsWith("/")) return next();

    const command = text.slice(1).split(/[\s@]/)[0].toLowerCase();
    const subject = await getSubject(env, command);
    if (!subject) return next();

    await ctx.reply(`📖 ${subject.display_name}\n\n${subject.drive_link}`);
  });
}

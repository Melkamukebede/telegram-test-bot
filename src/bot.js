import { Bot } from "grammy";
import { registerCallbacks } from "./handlers/callbacks.js";
import { registerStudentCommands, registerSubjectCatcher } from "./commands/student.js";
import { registerAdminCommands } from "./commands/admin.js";
import { registerUpload } from "./commands/upload.js";
import { registerGuide } from "./commands/guide.js";
import { registerRegistration } from "./handlers/registration.js";

export function createBot(env, origin = "") {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Real commands and buttons first...
  registerCallbacks(bot, env);
  registerStudentCommands(bot, env);
  registerAdminCommands(bot, env);
  registerUpload(bot, env);
  registerGuide(bot, env, origin);

  // ...then the catch-alls, in this exact order:
  registerSubjectCatcher(bot, env); // /logic, /physics ... from the subjects table
  registerRegistration(bot, env);   // plain text answers during /register. Always last.

  // Log the error and return normally. Without this, one failure makes Telegram
  // retry the same update again and again.
  bot.catch(async (err) => {
    console.error("Bot error:", err.error?.message || err);
    try {
      if (err.ctx?.chat?.type === "private") {
        await err.ctx.reply("Something went wrong. Please try again in a moment.");
      }
    } catch {}
  });

  return bot;
}

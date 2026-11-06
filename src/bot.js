import { Bot } from "grammy";
import { registerCallbacks } from "./handlers/callbacks.js";
import { registerStudentCommands } from "./commands/student.js";
import { registerAdminCommands } from "./commands/admin.js";
import { registerUpload } from "./commands/upload.js";
import { registerGuide } from "./commands/guide.js";
import { registerRegistration } from "./handlers/registration.js";

export function createBot(env, origin = "") {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  registerCallbacks(bot, env);
  registerStudentCommands(bot, env);
  registerAdminCommands(bot, env);
  registerUpload(bot, env);
  registerGuide(bot, env, origin);

  // Plain text answers during /register. Always last.
  registerRegistration(bot, env);

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

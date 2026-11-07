import { isPrivate } from "../auth.js";
import { getUser, upsertUser } from "../db.js";
import { FLOW, questionText } from "../config.js";

// A number picks from the list (the last one is "Other"); anything else is saved as typed.
function pick(list, text) {
  const n = parseInt(text, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= list.length) return list[n - 1];
  return text.slice(0, 80);
}

// Must be registered LAST: it answers every private text message nothing else claimed.
export function registerRegistration(bot, env) {
  bot.on("message:text", async (ctx) => {
    if (!isPrivate(ctx)) return;

    const id = String(ctx.from.id);
    const text = ctx.message.text.trim();
    const user = await getUser(env, id);

    if (!user || !user.step) {
      await ctx.reply("Type /register to get started, or /menu for options.");
      return;
    }
    if (text.startsWith("/")) {
      await ctx.reply("I don't know that command. Finish the question above, or type /menu.");
      return;
    }

    const i = FLOW.findIndex((s) => s.step === user.step);
    if (i === -1) {
      await ctx.reply("Something went off track. Type /register to start over.");
      return;
    }

    const value = pick(FLOW[i].list, text);

    if (i < FLOW.length - 1) {
      await upsertUser(env, id, { [FLOW[i].field]: value, step: FLOW[i + 1].step });
      await ctx.reply(questionText(i + 1));
      return;
    }

    await upsertUser(env, id, { [FLOW[i].field]: value, step: null });
    const u = await getUser(env, id);
    await ctx.reply(
      "✅ Registration Complete!\n\n" +
        `University: ${u.university}\nMajor: ${u.major}\nCity: ${u.city}\nSemester: ${u.semester}\n\n` +
        "Answer the daily questions in the channel to build your streak. Your first name appears on the leaderboard. Welcome! "
    );
  });
}

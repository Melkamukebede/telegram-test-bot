import { requireAdmin } from "../auth.js";
import { PROMPT_TEMPLATE, SETUP_SECTIONS, DAILY_ROUTINE } from "../web/content.js";

// Packs text blocks into messages under Telegram's 4096-character limit
function chunk(blocks, max = 3800) {
  const out = [];
  let cur = "";
  for (const b of blocks) {
    if (cur && (cur + "\n\n" + b).length > max) { out.push(cur); cur = b; }
    else cur = cur ? cur + "\n\n" + b : b;
  }
  if (cur) out.push(cur);
  return out;
}

export function registerGuide(bot, env, origin) {
  const link = () =>
    origin ? `\n\nFull guide: ${origin}/guide${env.GUIDE_KEY ? `?key=${env.GUIDE_KEY}` : ""}` : "";

  bot.command("promptguide", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    await ctx.reply("Copy the next message into your AI tool. Replace the [BRACKETS], then send the .txt result back to me as a File.");
    await ctx.reply(PROMPT_TEMPLATE);
    await ctx.reply("Tip: the subject key (like td) is what you type in /setplan." + link());
  });

  bot.command("setupsteps", async (ctx) => {
    if (!(await requireAdmin(ctx, env))) return;
    const blocks = SETUP_SECTIONS.map(
      (s, i) => `${i + 1}. ${s.title}\n` + s.steps.map((st) => `• ${st}`).join("\n")
    );
    blocks.push("Daily routine\n" + DAILY_ROUTINE.map((s, i) => `${i + 1}. ${s}`).join("\n"));
    for (const msg of chunk(blocks)) await ctx.reply(msg, { link_preview_options: { is_disabled: true } });
    if (origin) await ctx.reply(link().trim());
  });
}

import { Bot, webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { isPaused } from "./db.js";
import { postDailyQuestions, postReveals, postLeaderboard, postPromo } from "./services/scheduler.js";
import { renderGuidePage } from "./web/guidePage.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      if (url.pathname === "/guide") {
        // If GUIDE_KEY is set, the page needs ?key=VALUE
        if (env.GUIDE_KEY && url.searchParams.get("key") !== env.GUIDE_KEY) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(renderGuidePage(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Sinahard bot is running.", { status: 200 });
    }

    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const bot = createBot(env, url.origin);
    // If WEBHOOK_SECRET is set, requests without Telegram's secret header are rejected
    const handle = webhookCallback(bot, "cloudflare-mod", { secretToken: env.WEBHOOK_SECRET });
    return handle(request);
  },

  // The UTC hour decides which job runs (Addis Ababa = UTC+3):
  //   06:00 UTC = 9:00 AM   daily questions
  //   13:00 UTC = 4:00 PM   Sinahard promo (Mon/Wed/Fri, set by the cron in wrangler.toml)
  //   16:00 UTC = 7:00 PM   answers and explanations
  //   17:00 UTC = 8:00 PM   leaderboard (Sunday only)
  async scheduled(event, env, ctx) {
    const api = new Bot(env.TELEGRAM_BOT_TOKEN).api;
    const when = new Date(event.scheduledTime);
    const hour = when.getUTCHours();
    const day = when.getUTCDay(); // 0 = Sunday

    const alertOwner = async (msg) => {
      try { await api.sendMessage(env.ADMIN_ID, msg); } catch {}
    };

    try {
      if (hour === 6) {
        if (await isPaused(env)) {
          await alertOwner("⏸ Auto-posting is paused, so no questions were posted today. Send /resume when you're ready.");
        } else {
          const r = await postDailyQuestions(env, api);
          if (r.status === "empty") {
            await alertOwner("⚠️ The queue is empty, so nothing was posted at 9 AM. Upload questions as a .txt file.");
          } else if (r.status === "ok" && r.left < r.target) {
            await alertOwner(`⚠️ Queue is low: ${r.left} question(s) left, and the daily quota is ${r.target}. Upload more soon.`);
          }
        }
      } else if (hour === 13) {
        await postPromo(env, api);
      } else if (hour === 16) {
        await postReveals(env, api);
      } else if (hour === 17 && day === 0) {
        await postLeaderboard(env, api);
      }
    } catch (err) {
      console.error("Scheduled job failed:", err);
      await alertOwner(`⚠️ Scheduled job (UTC hour ${hour}) failed: ${err.message}`);
    }
  },
};

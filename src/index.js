import { Bot, webhookCallback } from "grammy";
import { createBot } from "./bot.js";
import { postDailyQuestions, postReveals, postLeaderboard, postPromo } from "./services/scheduler.js";
import { renderGuidePage } from "./web/guidePage.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      if (url.pathname === "/guide") {
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
    const handle = webhookCallback(bot, "cloudflare-mod", { secretToken: env.WEBHOOK_SECRET });
    return handle(request);
  },

  // The hour (UTC) decides which job runs:
  // 05 questions, 11 answers, 13 promo (Mon/Wed/Fri), 15 leaderboard (Sunday)
  async scheduled(event, env, ctx) {
    const api = new Bot(env.TELEGRAM_BOT_TOKEN).api;
    const when = new Date(event.scheduledTime);
    const hour = when.getUTCHours();
    const day = when.getUTCDay(); // 0 = Sunday

    const alertOwner = async (msg) => {
      try { await api.sendMessage(env.ADMIN_ID, msg); } catch {}
    };

    try {
      if (hour === 5) {
        const r = await postDailyQuestions(env, api);
        if (r.status === "no_plan") {
          await alertOwner("⚠️ No plan set for today, so nothing was posted. Use /setplan <subject> <count>.");
        } else if (r.status === "empty") {
          await alertOwner(`⚠️ No unposted questions left for "${r.subject}". Upload more.`);
        }
      } else if (hour === 11) {
        await postReveals(env, api);
      } else if (hour === 13) {
        await postPromo(env, api);
      } else if (hour === 15 && day === 0) {
        await postLeaderboard(env, api);
      }
    } catch (err) {
      console.error("Scheduled job failed:", err);
      await alertOwner(`⚠️ Scheduled job (UTC hour ${hour}) failed: ${err.message}`);
    }
  },
};

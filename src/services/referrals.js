import { InlineKeyboard } from "grammy";

export const REQUIRED_CHANNEL_ID = "-1003958927040";
const MIN_REFERRALS = 3;
const MIN_CHANNEL_MEMBERS = 2;

function inviteUrl(username, telegramId) {
  return `https://t.me/${username}?start=ref_${telegramId}`;
}

export async function recordReferral(env, referrerId, referredId) {
  if (!referrerId || referrerId === referredId) return false;
  const referrer = await env.DB.prepare(
    "SELECT telegram_id FROM users WHERE telegram_id = ?"
  ).bind(referrerId).first();
  if (!referrer) return false;
  const existing = await env.DB.prepare(
    "SELECT referred_id FROM referrals WHERE referred_id = ?"
  ).bind(referredId).first();
  if (existing) return false;
  await env.DB.prepare(
    "INSERT INTO referrals (referrer_id, referred_id, created_at) VALUES (?, ?, ?)"
  ).bind(referrerId, referredId, new Date().toISOString()).run();
  return true;
}

async function getReferralStats(env, referrerId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(r.referred_id) AS total_referrals,
            COALESCE(SUM(CASE WHEN rm.is_member = 1 THEN 1 ELSE 0 END), 0) AS verified_invites
     FROM referrals r
     LEFT JOIN referral_memberships rm
       ON rm.referrer_id = r.referrer_id AND rm.referred_id = r.referred_id
     WHERE r.referrer_id = ?`
  ).bind(referrerId).first();
  return {
    total: Number(row?.total_referrals || 0),
    members: Number(row?.verified_invites || 0),
  };
}

export async function refreshReferralAccess(ctx, env, referrerId) {
  const user = await env.DB.prepare(
    "SELECT telegram_id FROM users WHERE telegram_id = ?"
  ).bind(referrerId).first();
  if (!user) return { total: 0, members: 0, unlocked: false };
  const referrals = await env.DB.prepare(
    "SELECT referred_id FROM referrals WHERE referrer_id = ? ORDER BY created_at"
  ).bind(referrerId).all();
  let members = 0;
  for (const referral of referrals.results || []) {
    let isMember = false;
    try {
      const member = await ctx.api.getChatMember(REQUIRED_CHANNEL_ID, referral.referred_id);
      isMember = ["creator", "administrator", "member"].includes(member.status) ||
        (member.status === "restricted" && member.is_member === true);
    } catch (error) {
      // Telegram returns an error for users who have never joined; that is a normal negative check.
      console.warn(`Channel membership check failed for ${referral.referred_id}:`, error.message);
    }
    if (isMember) members++;
    await env.DB.prepare(
      `INSERT INTO referral_memberships (referrer_id, referred_id, is_member, checked_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(referrer_id, referred_id) DO UPDATE SET
         is_member = excluded.is_member, checked_at = excluded.checked_at`
    ).bind(referrerId, referral.referred_id, isMember ? 1 : 0, new Date().toISOString()).run();
  }

  const total = referrals.results?.length || 0;
  const unlocked = total >= MIN_REFERRALS && members >= MIN_CHANNEL_MEMBERS;
  await env.DB.prepare(
    `INSERT INTO exam_access
     (telegram_id, unlocked_at, verified_invites, total_referrals)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET
       unlocked_at = CASE
         WHEN exam_access.unlocked_at IS NOT NULL THEN exam_access.unlocked_at
         WHEN excluded.unlocked_at IS NOT NULL THEN excluded.unlocked_at
         ELSE NULL END,
       verified_invites = excluded.verified_invites,
       total_referrals = excluded.total_referrals`
  ).bind(referrerId, unlocked ? new Date().toISOString() : null, members, total).run();
  return { total, members, unlocked };
}

export async function getReferralStatus(env, referrerId) {
  const stats = await getReferralStats(env, referrerId);
  const access = await env.DB.prepare(
    "SELECT unlocked_at FROM exam_access WHERE telegram_id = ?"
  ).bind(referrerId).first();
  return { ...stats, unlocked: Boolean(access?.unlocked_at) };
}

export async function sendReferralInvite(ctx, env) {
  const username = ctx.me?.username;
  if (!username) {
    await ctx.reply("The bot username is not available yet. Please try again shortly.");
    return;
  }
  const id = String(ctx.from.id);
  const status = await getReferralStatus(env, id);
  const url = inviteUrl(username, id);
  const keyboard = new InlineKeyboard()
    .url("📤 Share invite link", `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Join me for Ethiopian freshman exam practice!")}`)
    .row()
    .text("🔄 Check unlock status", "check_referrals");
  await ctx.reply(
    `🎓 <b>Unlock exam practice</b>\n\n` +
    `Share your personal link with at least 3 students.\n` +
    `At least 2 of them must join our channel before full exams unlock.\n\n` +
    `Progress: <b>${status.total}/3 invited</b> • <b>${status.members}/2 channel joins</b>\n\n` +
    `<code>${url}</code>`,
    { parse_mode: "HTML", reply_markup: keyboard }
  );
}

export async function checkReferralUnlock(ctx, env) {
  const result = await refreshReferralAccess(ctx, env, String(ctx.from.id));
  const message = result.unlocked
    ? "✅ Exam practice unlocked! Use /exams to start."
    : `🔒 Not unlocked yet.\n\nProgress: ${result.total}/3 invited, ${result.members}/2 verified channel joins.\n\nAsk 3 students to open your link and ask at least 2 of them to join the channel.`;
  await ctx.answerCallbackQuery({ text: result.unlocked ? "Unlocked!" : "Keep going." });
  await ctx.reply(message);
}

export async function requireExamAccess(ctx, env) {
  const status = await getReferralStatus(env, String(ctx.from.id));
  if (status.unlocked) return true;
  await ctx.reply(
    `🔒 Exam practice is locked.\n\nInvite 3 students and get 2 verified channel joins.\nProgress: ${status.total}/3 invited • ${status.members}/2 joins`,
    { reply_markup: new InlineKeyboard().text("🎓 Unlock exam access", "show_referrals") }
  );
  return false;
}

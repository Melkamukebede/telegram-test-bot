export const isPrivate = (ctx) => ctx.chat?.type === "private";

export const isGroup = (ctx) =>
  ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

// The owner is the user ID stored in the ADMIN_ID secret
export function isOwner(ctx, env) {
  return String(ctx.from?.id) === String(env.ADMIN_ID).trim();
}

// Admins = owner + anyone in the admins table
export async function isAdmin(ctx, env) {
  if (isOwner(ctx, env)) return true;
  try {
    const row = await env.DB.prepare("SELECT telegram_id FROM admins WHERE telegram_id = ?")
      .bind(String(ctx.from?.id)).first();
    return !!row;
  } catch {
    return false; // if the lookup fails, deny access
  }
}

// One guard for every admin command. Returns true if the caller may continue.
// Silently ignores groups so admin commands never appear to exist there.
export async function requireAdmin(ctx, env, ownerOnly = false) {
  if (!isPrivate(ctx)) return false;
  const ok = ownerOnly ? isOwner(ctx, env) : await isAdmin(ctx, env);
  if (!ok) await ctx.reply(ownerOnly ? "Only the owner can do that." : "Admins only.");
  return ok;
}
// "owner" | "admin" | "student"
export async function roleOf(ctx, env) {
  if (isOwner(ctx, env)) return "owner";
  return (await isAdmin(ctx, env)) ? "admin" : "student";
}

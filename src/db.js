import { DEFAULT_DAILY } from "./config.js";
export async function getUser(env, telegramId) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE telegram_id = ?")
    .bind(telegramId).first();
  return row || null;
}

export async function upsertUser(env, telegramId, fields) {
  const keys = Object.keys(fields);
  const values = keys.map((k) => fields[k]);
  const existing = await getUser(env, telegramId);

  if (existing) {
    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    await env.DB.prepare(`UPDATE users SET ${setClause} WHERE telegram_id = ?`)
      .bind(...values, telegramId).run();
  } else {
    const placeholders = keys.map(() => "?").join(", ");
    await env.DB.prepare(
      `INSERT INTO users (telegram_id, ${keys.join(", ")}) VALUES (?, ${placeholders})`
    ).bind(telegramId, ...values).run();
  }
}

export async function startRegistration(env, telegramId, firstName = "") {
  const existing = await getUser(env, telegramId);
  const fields = { step: "awaiting_university" };
  if (firstName) fields.first_name = firstName.slice(0, 20);
  if (!existing) fields.registered_at = new Date().toISOString();
  await upsertUser(env, telegramId, fields);
}

export async function isPaused(env) {
  try {
    return (await getSetting(env, "paused", "0")) === "1";
  } catch {
    return false; // if the settings table has a problem, keep posting
  }
}
export async function getSubject(env, command) {
  const row = await env.DB.prepare("SELECT * FROM subjects WHERE command = ?")
    .bind(command).first();
  return row || null;
}

export async function getAllSubjects(env) {
  const { results } = await env.DB.prepare(
    "SELECT command, display_name FROM subjects ORDER BY display_name"
  ).all();
  return results || [];
}

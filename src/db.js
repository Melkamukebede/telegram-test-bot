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
  await env.DB.prepare("DELETE FROM user_exam_subjects WHERE telegram_id = ?").bind(telegramId).run();
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
export async function getExamSubjects(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, command, display_name FROM exam_subjects ORDER BY display_name"
  ).all();
  return results || [];
}

export async function getUserExamSubjects(env, telegramId) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.command, s.display_name
     FROM user_exam_subjects us
     JOIN exam_subjects s ON s.id = us.subject_id
     WHERE us.telegram_id = ? ORDER BY s.display_name`
  ).bind(telegramId).all();
  return results || [];
}

export async function getSubjectExamSummary(env, telegramId) {
  const { results } = await env.DB.prepare(
    `SELECT s.display_name, e.exam_type, e.exam_year, e.title, e.duration_minutes,
            COUNT(q.id) AS question_count
     FROM user_exam_subjects us
     JOIN exam_subjects s ON s.id = us.subject_id
     LEFT JOIN exams e ON e.subject_id = s.id AND e.is_published = 1
     LEFT JOIN exam_questions q ON q.exam_id = e.id
     WHERE us.telegram_id = ? AND e.id IS NOT NULL
     GROUP BY e.id
     ORDER BY s.display_name, e.exam_year DESC, e.exam_type`
  ).bind(telegramId).all();
  return results || [];
}
export async function getSetting(env, key, fallback = null) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? row.value : fallback;
}

export async function setSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(key, String(value)).run();
}

// If the table is missing or the value is bad, fall back to 4 so the 9 AM job never dies over a setting
export async function getDailyTarget(env) {
  try {
    const v = parseInt(await getSetting(env, "daily_target", ""), 10);
    return Number.isInteger(v) && v >= 1 ? v : DEFAULT_DAILY;
  } catch {
    return DEFAULT_DAILY;
  }
}

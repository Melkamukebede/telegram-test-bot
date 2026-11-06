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

// Used by /register and the "Register Now" button
export async function startRegistration(env, telegramId) {
  const existing = await getUser(env, telegramId);
  const fields = { step: "awaiting_university" };
  if (!existing) fields.registered_at = new Date().toISOString();
  await upsertUser(env, telegramId, fields);
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

CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  university TEXT, major TEXT, city TEXT, semester TEXT,
  step TEXT,
  streak INTEGER DEFAULT 0,
  last_answered_date TEXT,
  registered_at TEXT
);

CREATE TABLE IF NOT EXISTS subjects (
  command TEXT PRIMARY KEY,
  display_name TEXT,
  drive_link TEXT
);

CREATE TABLE IF NOT EXISTS daily_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT, grade TEXT, topic TEXT,
  question_text TEXT,
  option1 TEXT, option2 TEXT, option3 TEXT, option4 TEXT,
  correct_option INTEGER,
  explanation TEXT,
  batch_id TEXT,
  post_date TEXT,
  is_posted INTEGER DEFAULT 0,
  posted_at TEXT,
  session_date TEXT,
  is_revealed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS answers (
  telegram_id TEXT,
  question_id INTEGER,
  selected_option INTEGER,
  is_correct INTEGER,
  answered_at TEXT,
  PRIMARY KEY (telegram_id, question_id)
);

CREATE TABLE IF NOT EXISTS daily_plan (
  plan_date TEXT PRIMARY KEY,
  subject TEXT,
  question_count INTEGER
);

CREATE TABLE IF NOT EXISTS admins (
  telegram_id TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_questions_queue ON daily_questions (subject, is_posted);
CREATE INDEX IF NOT EXISTS idx_questions_session ON daily_questions (session_date, is_posted, is_revealed);

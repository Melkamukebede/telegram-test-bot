CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  first_name TEXT,
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

CREATE TABLE IF NOT EXISTS exam_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('midterm', 'final')),
  exam_year INTEGER NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 45,
  is_published INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(subject_id, exam_type, exam_year),
  FOREIGN KEY (subject_id) REFERENCES exam_subjects(id)
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  question_number INTEGER NOT NULL,
  topic TEXT,
  question_text TEXT NOT NULL,
  option1 TEXT NOT NULL,
  option2 TEXT NOT NULL,
  option3 TEXT NOT NULL,
  option4 TEXT NOT NULL,
  correct_option INTEGER NOT NULL CHECK (correct_option BETWEEN 1 AND 4),
  explanation TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(exam_id, question_number),
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

CREATE TABLE IF NOT EXISTS user_exam_subjects (
  telegram_id TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  selected_at TEXT NOT NULL,
  PRIMARY KEY (telegram_id, subject_id),
  FOREIGN KEY (subject_id) REFERENCES exam_subjects(id)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  exam_id INTEGER NOT NULL,
  current_index INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  total_questions INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  FOREIGN KEY (exam_id) REFERENCES exams(id)
);

CREATE TABLE IF NOT EXISTS exam_answers (
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  selected_option INTEGER NOT NULL CHECK (selected_option BETWEEN 1 AND 4),
  is_correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL,
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id),
  FOREIGN KEY (question_id) REFERENCES exam_questions(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  referrer_id TEXT NOT NULL,
  referred_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  FOREIGN KEY (referrer_id) REFERENCES users(telegram_id)
);

CREATE TABLE IF NOT EXISTS referral_memberships (
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL,
  is_member INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL,
  PRIMARY KEY (referrer_id, referred_id),
  FOREIGN KEY (referred_id) REFERENCES referrals(referred_id)
);

CREATE TABLE IF NOT EXISTS exam_access (
  telegram_id TEXT PRIMARY KEY,
  unlocked_at TEXT,
  verified_invites INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_queue ON daily_questions (subject, is_posted);
CREATE INDEX IF NOT EXISTS idx_questions_session ON daily_questions (session_date, is_posted, is_revealed);
CREATE INDEX IF NOT EXISTS idx_exams_catalog ON exams (subject_id, exam_type, exam_year, is_published);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions (exam_id, question_number);
CREATE INDEX IF NOT EXISTS idx_user_exam_subjects_user ON user_exam_subjects (telegram_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts (telegram_id, status, started_at);
CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON exam_answers (attempt_id, question_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_referral_memberships_referrer ON referral_memberships (referrer_id, is_member);
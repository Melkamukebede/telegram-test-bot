# Sinahard Telegram Test Bot

A Telegram learning bot for university students. It runs on **Cloudflare Workers**, uses **grammY** for Telegram updates, and stores users, questions, answers, and streaks in **Cloudflare D1**.

## Features

- Student registration for university, major, city, and semester
- Three mixed multiple-choice questions on Tuesday, Friday, Saturday, and Sunday
- Compact daily challenge cards with private per-user quizzes and channel answer reveals
- Student streaks and a Sunday leaderboard
- Admin question entry with `/addquestion`
- Guided `/addquestion` flow for exams or Telegram quizzes
- Paste question text or upload `.txt` files and preview added questions
- Exam catalog imports for freshman midterm and final exams by year
- Registration subject selection with a personal exam library
- Private four-question-per-page exam practice with scoring
- Referral and channel-membership unlock for exam access
- Daily subject plans and configurable question quotas
- Pause/resume controls for scheduled posting
- Sinahard promotional posts
- Setup guide available at `/guide`

## Project structure

```text
src/
  commands/       Student, admin, upload, and guide commands
  handlers/       Registration and callback-query handlers
  services/       Scheduling, parsing, menus, formatting, and cleanup
  web/            HTML guide content and page rendering
  auth.js         Owner/admin authorization
  bot.js          grammY bot registration
  config.js       Registration lists and bot configuration
  db.js           D1 database helpers
  index.js        Cloudflare Worker entry point
  screens.js      Telegram menu screens
schema.sql        D1 tables and indexes
wrangler.toml     Cloudflare Worker, D1, KV, and cron configuration
```

## Requirements

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Cloudflare account with Workers and D1 enabled
- A Telegram group or channel where the bot can post

## Installation

```bash
npm install
```

Initialize the D1 database with `schema.sql`, then configure the database and KV bindings in `wrangler.toml`.

Set these Worker secrets/variables:

| Name | Required | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram Bot API token |
| `ADMIN_ID` | Yes | Telegram user ID of the owner |
| `GROUP_CHAT_ID` | Yes | Chat where questions and answers are posted |
| `CHANNEL_ID` | No | Separate chat for promotional posts |
| `WEBHOOK_SECRET` | No | Validates Telegram webhook requests |
| `GUIDE_KEY` | No | Protects the `/guide` page with a query key |

## Development and deployment

```bash
npm run dev       # Run the Worker locally
npm run deploy    # Deploy to Cloudflare Workers
npm run tail      # Stream Worker logs
```

The configured cron jobs run in UTC:

- `06:00` on Tuesday, Friday, Saturday, and Sunday — post three mixed questions (9:00 AM Addis Ababa)
- `16:00` on Monday, Wednesday, Saturday, and Sunday — reveal answers with view buttons (7:00 PM Addis Ababa)
- `13:00` on Monday, Wednesday, and Friday — post the Sinahard promotion
- `17:00` on Sunday — post the leaderboard

The daily channel post contains one compact challenge card. Students tap the button
to answer privately in the bot, so the channel stays easy to scan. Answers and
explanations are posted together in the channel at the evening reveal time.

## Student commands

| Command | Description |
| --- | --- |
| `/start` | Show the main menu |
| `/register` | Start or restart registration |
| `/myinfo` | Show saved registration information |
| `/exams` | Open the private exam library |
| `/invite` | Get a personal referral link |
| `/unlock` | Check referral unlock progress |
| `/manual` | Open the full usage manual |
| `/app` | Show the Sinahard app link |
| `/help` | Show available help |

## Admin commands

Admins use these commands in a private chat with the bot:

- `/addquestion subject | question | option A | option B | option C | option D | correct`
- `/queue` — show unposted questions by subject
- `/setplan subject [count]` — prioritize a subject for today
- `/setdaily 1-20` — set the default daily quota
- `/today` — show today's posting status
- `/leaderboard` — post the current leaderboard to the channel
- `/pause` and `/resume` — control scheduled question posting
- `/testquestion` — post questions immediately
- `/testreveal` — reveal answers immediately
- `/testpromo` — post a promotion immediately
- `/addadmin <telegram_user_id>` and `/removeadmin <telegram_user_id>`
- `/promptguide` and `/setupsteps` — show question-generation and setup instructions

## Testing checklist

1. Apply the complete `schema.sql` to the deployed D1 database:
   `npx wrangler d1 execute freshman_hub_db --remote --file=schema.sql`
2. Make the bot an administrator in channel `-1003958927040`.
3. Deploy and monitor logs with `npm run deploy` and `npm run tail`.
4. As a student, send `/start`, `/register`, and choose three subjects.
5. Send `/invite`; test with three different Telegram accounts using the generated link.
6. Ask two referred accounts to join the required channel, then send `/unlock`.
7. Send `/exams`, choose an exam, answer four questions, confirm each answer reveals its explanation, and verify **Next 4 questions** appears only after all four are answered.
8. Interrupt an attempt and send `/exams` again to verify it resumes at the first unanswered page.
9. As an admin, upload an exam `.txt` file, then repeat steps 4–8.

Use `/manual` inside Telegram for the same student, admin, upload, testing, and
troubleshooting instructions in split messages that fit Telegram's message limit.

Paste the complete exam text directly into the bot, or send a `.txt` file as a
Telegram File. The bot automatically detects the exam headers and imports the
questions. The expected format is:

```text
Grade: Senior University
Subject: TD (Technical Drawing)
Topic: Multiview Drawing

1. Question text?
   A) First option
   B) Second option
   C) Third option
   D) Fourth option
   Answer: B
   Explanation:
   The explanation for the answer.
```

Questions must be numbered consecutively and contain exactly four options labeled `A)` through `D)` plus an `Answer:` line.

Exam catalog files use the same question format with these additional headers:

```text
Subject: Physics (Freshman Physics)
ExamType: Midterm
ExamYear: 2024
ExamTitle: Freshman Physics Midterm 2024
DurationMinutes: 45
Topic: Mechanics
```

`ExamType` must be `Midterm` or `Final`. Re-uploading the same subject, exam type,
and year replaces that exam's questions, making corrections safe and repeatable.

After the university, major, city, and semester questions, each student selects
up to three available exam subjects. The `/exams` command then lists the available midterm and
final exams for those subjects. Students can select an exam, answer privately
one question at a time, and receive a final score.

The `/exams` command now opens a button-based private exam library. Selecting an
exam creates a resumable attempt with four questions per page. Each question
keeps its answer and explanation hidden until the student chooses A-D, then
immediately reveals the student's choice, the correct answer, and explanation.
Completed exams are hidden from `/exams`; active exams appear with a Resume label.
The final score is shown after the last question.

Exam access is protected by `/invite` and `/unlock`: a student must bring three
unique students into the bot, and at least two of those referred students must
join channel `-1003958927040`. The bot must be an administrator in that channel
to verify membership.

## Database

`schema.sql` defines tables for:

- `users`
- `subjects`
- `daily_questions`
- `answers`
- `daily_plan`
- `admins`

The application also expects a `settings` table for pause state and the daily quota, and a `first_name` column in `users` for leaderboard names. Add those fields to the deployed D1 database if they are not already present.

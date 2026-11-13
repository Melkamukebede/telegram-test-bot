# Sinahard Telegram Test Bot

A Telegram learning bot for university students. It runs on **Cloudflare Workers**, uses **grammY** for Telegram updates, and stores users, questions, answers, and streaks in **Cloudflare D1**.

## Features

- Student registration for university, major, city, and semester
- Daily multiple-choice questions with A-D answer buttons
- Spoiler-collapsed question posts with compact per-question answer reveals
- Student streaks and a Sunday leaderboard
- Admin question entry with `/addquestion`
- Bulk question import from `.txt` files
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

- `06:00` — post daily questions
- `13:00` on Monday, Wednesday, and Friday — post the Sinahard promotion
- `16:00` — reveal answers and explanations
- `17:00` on Sunday — post the leaderboard

## Student commands

| Command | Description |
| --- | --- |
| `/start` | Show the main menu |
| `/register` | Start or restart registration |
| `/myinfo` | Show saved registration information |
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

Send a plain `.txt` file to the bot for bulk import. The expected format is:

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

## Database

`schema.sql` defines tables for:

- `users`
- `subjects`
- `daily_questions`
- `answers`
- `daily_plan`
- `admins`

The application also expects a `settings` table for pause state and the daily quota, and a `first_name` column in `users` for leaderboard names. Add those fields to the deployed D1 database if they are not already present.

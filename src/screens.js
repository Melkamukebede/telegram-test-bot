import { InlineKeyboard } from "grammy";
import { getUser, getAllSubjects } from "./db.js";

export function mainMenuScreen() {
  const keyboard = new InlineKeyboard()
    .text("📋 My Info", "screen_info")
    .text("📚 Subjects", "screen_subjects")
    .row()
    .text("🏆 Leaderboard", "show_leaderboard")
    .text("ℹ️ Help", "screen_help");
  return { text: "🎓 Freshman Hub 2026\nWhat would you like to do?", keyboard };
}

export async function infoScreen(env, telegramId) {
  const user = await getUser(env, telegramId);
  const registered = user && user.university && !user.step;
  const keyboard = new InlineKeyboard();
  if (!registered) keyboard.text("📝 Register Now", "start_register").row();
  keyboard.text("⬅ Back", "main_menu");

  const text = registered
    ? `Your Info:\nUniversity: ${user.university}\nMajor: ${user.major}\nCity: ${user.city}\nSemester: ${user.semester}\nStreak: 🔥${user.streak || 0}`
    : "You haven't finished registering yet.\nTap below to get started.";
  return { text, keyboard };
}

export async function subjectsScreen(env) {
  const subjects = await getAllSubjects(env);
  const keyboard = new InlineKeyboard();
  subjects.forEach((s, i) => {
    keyboard.text(s.display_name, `subject_${s.command}`);
    if (i % 2 === 1) keyboard.row();
  });
  keyboard.row().text("⬅ Back", "main_menu");
  return {
    text: subjects.length ? "📚 Pick a subject:" : "No subjects have been added yet.",
    keyboard,
  };
}

export function helpScreen() {
  const keyboard = new InlineKeyboard().text("⬅ Back", "main_menu");
  return {
    text:
      "Commands:\n" +
      "/menu - open the button menu\n" +
      "/register - start registration\n" +
      "/myinfo - view your saved info\n" +
      "/subjects - list all subjects\n" +
      "/drive - master resource list\n" +
      "/leaderboard - show the leaderboard in the group",
    keyboard,
  };
}

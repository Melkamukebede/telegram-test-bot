import { InlineKeyboard } from "grammy";
import { getUser } from "./db.js";
import { BRAND, SINAHARD_URL } from "./config.js";

export function mainMenuScreen() {
  const keyboard = new InlineKeyboard()
    .text("📋 My Info", "screen_info")
    .text("🏆 Leaderboard", "show_leaderboard")
    .row()
    .text("• Help", "screen_help")
    .url("• Sinahard App", SINAHARD_URL);
  return { text: `🎓 ${BRAND}\nWhat would you like to do?`, keyboard };
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

export function helpScreen() {
  const keyboard = new InlineKeyboard().text("⬅ Back", "main_menu");
  return {
    text:
      "Commands:\n" +
      "/menu - open the button menu\n" +
      "/register - start registration\n" +
      "/myinfo - view your saved info\n" +
      "/app - open the Sinahard app\n" +
      "/leaderboard - show the leaderboard in the channel",
    keyboard,
  };
}

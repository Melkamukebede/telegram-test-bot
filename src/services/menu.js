import { STUDENT_COMMANDS, ADMIN_COMMANDS, OWNER_COMMANDS } from "../commandLists.js";

function commandsFor(role) {
  if (role === "owner") return [...STUDENT_COMMANDS, ...ADMIN_COMMANDS, ...OWNER_COMMANDS];
  if (role === "admin") return [...STUDENT_COMMANDS, ...ADMIN_COMMANDS];
  return STUDENT_COMMANDS;
}

// Sets the "/" menu for ONE private chat. Returns true if Telegram accepted it.
// It can fail for someone who has never opened the bot; that is why we also
// run it on /start and /help.
export async function syncMenuFor(api, userId, role) {
  const scope = { type: "chat", chat_id: Number(userId) };
  try {
    if (role === "student") {
      await api.deleteMyCommands({ scope }); // back to the normal student menu
    } else {
      await api.setMyCommands(commandsFor(role), { scope });
    }
    return true;
  } catch (e) {
    console.error(`Menu sync failed for ${userId}:`, e.message);
    return false;
  }
}

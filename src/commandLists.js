// Telegram's "/" menu entries. Command names: lowercase letters, digits, underscore.
export const STUDENT_COMMANDS = [
  { command: "start", description: "Welcome to Sinahard" },
  { command: "register", description: "Register and set up your profile" },
  { command: "menu", description: "Open the main menu" },
  { command: "myinfo", description: "View your saved registration info" },
  { command: "app", description: "Open the Sinahard app" },
  { command: "leaderboard", description: "View the current leaderboard" },
  { command: "help", description: "Get help and list of commands" },
];

export const ADMIN_COMMANDS = [
  { command: "queue", description: "Unposted questions waiting, per subject" },
  { command: "setplan", description: "Set today's subject and question count" },
  { command: "testquestion", description: "Post today's questions now" },
  { command: "testreveal", description: "Post answers and explanations now" },
  { command: "testpromo", description: "Post the Sinahard promo now" },
  { command: "addquestion", description: "Add one question by hand" },
  { command: "undobatch", description: "Delete the unposted questions of an import" },
  { command: "poststats", description: "Registration numbers" },
  { command: "promptguide", description: "Get the AI prompt for question files" },
  { command: "setupsteps", description: "Full setup checklist" },
  { command: "admins", description: "List the owner and admins" },
];

export const OWNER_COMMANDS = [
  { command: "addadmin", description: "Add an admin by user ID" },
  { command: "removeadmin", description: "Remove an admin" },
];

// Lines shown inside /help (these include the arguments)
export const ADMIN_HELP_LINES = [
  "/queue - unposted questions per subject",
  "/setplan <subject> <count> - today's subject and total",
  "/testquestion - post today's questions now",
  "/testreveal - post answers and explanations now",
  "/testpromo - post the Sinahard promo now",
  "/addquestion subject | Question | A | B | C | D | letter",
  "/undobatch <batch_id> - delete unposted questions of an import",
  "/poststats - registration numbers",
  "/promptguide - AI prompt for question files",
  "/setupsteps - setup checklist",
  "/admins - owner and admins",
  "Send a .txt file as a File to import questions",
];

export const OWNER_HELP_LINES = [
  "/addadmin <user_id> - add an admin",
  "/removeadmin <user_id> - remove an admin",
];

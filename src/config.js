export const UNIVERSITIES = [
  "AAU (Addis Ababa University)",
  "Adama Science & Technology University",
  "Bahir Dar University",
  "Mekelle University",
  "Jimma University",
  "Hawassa University",
  "Dilla University",
  "Other",
];

export const MAJORS = [
  "Civil Engineering",
  "Computer Science / Software Engineering",
  "Medicine / Health Sciences",
  "Business / Economics / Accounting",
  "Law",
  "Education / Pedagogy",
  "Nursing",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Social Sciences",
  "Natural Sciences",
  "Mathematics / Statistics",
  "Other",
];

export const CITIES = [
  "Addis Ababa", "Gondar", "Bahir Dar", "Hawassa",
  "Dire Dawa", "Mekelle", "Jimma", "Other",
];

export const SEMESTERS = [
  "Semester 1 (September intake)",
  "Semester 2 (February intake)",
];

// The registration questions, in order. Add or reorder steps here.
export const FLOW = [
  { step: "awaiting_university", field: "university", list: UNIVERSITIES, ask: "Which university will you be attending?" },
  { step: "awaiting_major", field: "major", list: MAJORS, ask: "📚 What is your intended major?" },
  { step: "awaiting_city", field: "city", list: CITIES, ask: "📍 Which city are you currently in?" },
  { step: "awaiting_semester", field: "semester", list: SEMESTERS, ask: "📅 Which semester are you starting?" },
];

export function numberedList(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

export function questionText(i) {
  return `${FLOW[i].ask}\n\nReply with a number:\n${numberedList(FLOW[i].list)}`;
}

// Addis Ababa is UTC+3 all year (no daylight saving).
// Every "today" in the bot uses this one function.
export function todayAddis() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
}

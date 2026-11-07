export const PROMPT_TEMPLATE = `You are an exam-question writer for university students.

Write [COUNT] multiple-choice questions.
Grade: [GRADE]
Subject: [SHORT KEY] ([FULL SUBJECT NAME])
Topic: [TOPIC]

Return ONLY plain text in exactly the format below. No introduction, no closing remarks, no markdown, no bold, no backticks, no code block.

================================================================
Grade: [GRADE]
Subject: [SHORT KEY] ([FULL SUBJECT NAME])
Topic: [TOPIC]
================================================================

1. Question text on a single line?
   A) Option text
   B) Option text
   C) Option text
   D) Option text
   Answer: B
   Explanation:
   Core Concept: one or two sentences.
   Key Reason: why the correct option is right.
   Distractor Analysis: why each wrong option is wrong.

Rules:
- SHORT KEY is one short word such as td, physics or logic.
- Number the questions 1, 2, 3 in order with no gaps.
- Exactly four options labelled A) B) C) D), and exactly one correct answer.
- Keep each question and each option on a single line.
- The Answer line holds one letter only: A, B, C or D.
- Spread the correct answers across A, B, C and D.
- Never use a numbered list inside an explanation. Write plain sentences.
- Wrong options must be believable. Test understanding, not wording.
- Do not repeat a question.`;

export const EXAMPLE_OUTPUT = `================================================================
Grade: Senior University
Subject: TD (Technical Drawing)
Topic: Chapter 3 - Multiview Drawing
================================================================

1. In engineering drawing, an edge is best defined as which of the following?
   A) The intersection of three or more surfaces meeting at a single point
   B) A line representing the boundary between two faces of an object
   C) A curved outline that marks the limit of a cylindrical surface
   D) The area enclosed by limiting elements on a curved surface
   Answer: B
   Explanation:
   Core Concept: Object features are classified into edges, corners and surfaces.
   Key Reason: An edge is the line that marks the boundary between two adjacent faces.
   Distractor Analysis: Option A describes a corner. Option C refers to a limiting element. Option D describes a surface.

2. Which principal view shows the width and height of an object?
   A) Top view
   B) Front view
   C) Right side view
   D) Auxiliary view
   Answer: B
   Explanation:
   Core Concept: Each principal view shows two of the three object dimensions.
   Key Reason: The front view shows width and height.
   Distractor Analysis: The top view shows width and depth. The side view shows height and depth. An auxiliary view shows true size of inclined features.`;

// [what the AI writes, what the bot does with it]
export const FORMAT_RULES = [
  ["Subject: TD (Technical Drawing)", "The text before the bracket becomes the subject key (td). You use that key in /setplan td 3. The bracket part is only for people."],
  ["Grade: and Topic:", "Saved with every question. The topic is shown under the question in the group."],
  ["1. Question text", "A new question starts at the next number in order (1, 2, 3...). A gap in numbering breaks the split."],
  ["A) B) C) D)", "Exactly four options, one line each. They become the A B C D buttons."],
  ["Answer: B", "One letter only. Stored as the correct option and used to score each tap."],
  ["Explanation:", "Everything after it, up to the next question number, is posted with the answer at 2 PM. Bold markers (**) are removed automatically."],
];

export const SETUP_SECTIONS = [
  {
    title: "First test",
    steps: [
      "DM the bot: /start, then /register and answer the four questions, then /myinfo.",
      "Send a question .txt file to the bot as a File. It replies with the number imported.",
      "Send /queue, then /setplan <subject> 2, then /testquestion. Two questions appear in the group.",
      "Tap an answer in the group, then send /testreveal. The answer and explanation appear.",
    ],
  },
];

export const DAILY_ROUTINE = [
  "Fill in the AI prompt (grade, subject key, topic, count) and run it in your AI tool.",
  "Save the output as a .txt file and send it to the bot as a File. Check the import summary.",
  "Send /queue to confirm the questions are waiting.",
  "Before 8 AM send /setplan <subject> <count>. The count is the total for that day.",
  "The bot posts at 8 AM and reveals answers with explanations at 2 PM. The leaderboard posts on Sunday at 6 PM.",
  "If the plan is missing or the queue is empty at 8 AM, the owner gets a warning message.",
];

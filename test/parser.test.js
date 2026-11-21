import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestionFile } from "../src/services/parser.js";

test("parses a complete catalog question", () => {
  const raw = `Subject: Physics (Freshman Physics)
ExamType: Midterm
ExamYear: 2024
ExamTitle: Freshman Physics Midterm 2024
DurationMinutes: 45

1. What is 2 + 2?
   A) 3
   B) 4
   C) 5
   D) 6
   Answer: B
   Explanation:
   Four is the sum.
`;

  const parsed = parseQuestionFile(raw);
  assert.equal(parsed.questions.length, 1);
  assert.deepEqual(parsed.questions[0].options, ["3", "4", "5", "6"]);
  assert.equal(parsed.questions[0].correct, 2);
  assert.equal(parsed.questions[0].explanation, "Four is the sum.");
  assert.equal(parsed.meta.exam_type, "Midterm");
  assert.equal(parsed.meta.exam_year, "2024");
});

test("skips malformed questions and continues parsing the next one", () => {
  const raw = `Subject: Math

1. Broken question
   A) One
   B) Two
   Answer: B

2. Valid question?
   A) Red
   B) Blue
   C) Green
   D) Yellow
   Answer: D
`;

  const parsed = parseQuestionFile(raw);
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].correct, 4);
  assert.equal(parsed.warnings.length, 1);
  assert.match(parsed.warnings[0], /Question 1 skipped/);
});

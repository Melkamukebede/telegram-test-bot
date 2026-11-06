// Turns the AI-generated .txt file into structured questions.
// Expected layout is documented on the /guide page.
export function parseQuestionFile(raw) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/^`+|`+$/g, "")); // strip backticks left over from copy/paste

  const meta = { grade: "", subject: "", topic: "" };
  const questions = [];
  const warnings = [];
  let current = null;
  let mode = "header"; // header -> question -> explanation
  let lastNumber = 0;
  let lastOpt = -1;

  const finish = () => {
    if (!current) return;
    const answerIdx = "ABCD".indexOf(current.answer);
    if (!current.text || current.options.some((o) => !o) || answerIdx === -1) {
      warnings.push(`Question ${current.number} skipped (needs text, options A-D and an Answer line)`);
    } else {
      questions.push({
        text: current.text.trim(),
        options: current.options.map((o) => o.trim()),
        correct: answerIdx + 1,
        explanation: current.explanation.replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim(),
      });
    }
    current = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (/^[=_-]{5,}$/.test(t)) continue; // separator lines

    // A new question starts only at the NEXT number in sequence, so a numbered
    // line inside an explanation can't split a question by accident.
    const qStart = t.match(/^(\d+)\.\s+(.+)$/);
    if (qStart && Number(qStart[1]) === lastNumber + 1) {
      finish();
      lastNumber += 1;
      current = { number: lastNumber, text: qStart[2], options: ["", "", "", ""], answer: "", explanation: "" };
      mode = "question";
      lastOpt = -1;
      continue;
    }

    if (mode === "header") {
      const m = t.match(/^(Grade|Subject|Topic):\s*(.+)$/i);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
      continue;
    }

    if (mode === "explanation") {
      // Tolerate "Answer: X" placed after the explanation
      const late = t.match(/^Answer:\s*([A-D])\s*$/i);
      if (late && !current.answer) current.answer = late[1].toUpperCase();
      else current.explanation += t + "\n";
      continue;
    }

    const opt = t.match(/^([A-D])\)\s*(.+)$/);
    const ans = t.match(/^Answer:\s*([A-D])/i);
    const exp = t.match(/^Explanation:\s*(.*)$/i);

    if (opt) {
      lastOpt = "ABCD".indexOf(opt[1]);
      current.options[lastOpt] = opt[2];
    } else if (ans) {
      current.answer = ans[1].toUpperCase();
    } else if (exp) {
      mode = "explanation";
      current.explanation = exp[1] + "\n";
    } else if (t) {
      // wrapped line: continues the question text or the last option
      if (lastOpt === -1) current.text += " " + t;
      else current.options[lastOpt] += " " + t;
    }
  }
  finish();
  return { meta, questions, warnings };
}

import { PROMPT_TEMPLATE, EXAMPLE_OUTPUT, FORMAT_RULES, SETUP_SECTIONS, DAILY_ROUTINE } from "./content.js";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderGuidePage() {
  const rules = FORMAT_RULES
    .map(([a, b]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(b)}</td></tr>`)
    .join("");

  const setup = SETUP_SECTIONS
    .map((s, i) =>
      `<h3>${i + 1}. ${esc(s.title)}</h3><ol>${s.steps.map((st) => `<li>${esc(st)}</li>`).join("")}</ol>`
    )
    .join("");

  const routine = DAILY_ROUTINE.map((s) => `<li>${esc(s)}</li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Freshman Hub - Bot Guide</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#5f6368;--card:#f4f5f7;--line:#d9dce1;--accent:#1d6fdc}
@media (prefers-color-scheme:dark){:root{--bg:#14161a;--fg:#e8eaed;--muted:#9aa0a6;--card:#1e2126;--line:#33373d;--accent:#6aa7ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.6rem;margin:0 0 4px}
h2{margin:40px 0 8px;font-size:1.25rem;border-top:1px solid var(--line);padding-top:24px}
h3{margin:24px 0 4px;font-size:1.05rem}
p.sub{color:var(--muted);margin:0 0 8px}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;font-size:.85rem;margin:8px 0}
code{background:var(--card);padding:1px 5px;border-radius:4px;font-size:.85em}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.92rem}
td{border:1px solid var(--line);padding:8px;vertical-align:top}
td:first-child{white-space:nowrap}
button{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:.9rem;cursor:pointer}
li{margin:4px 0}
</style>
</head>
<body>
<main>
<h1>Freshman Hub 2026 - Bot Guide</h1>
<p class="sub">How to get AI-written questions into the bot, and the full setup order.</p>

<h2>1. The AI prompt</h2>
<p class="sub">Replace the [BRACKETS], paste it into your AI tool, and save the reply as a .txt file.</p>
<button onclick="copyText('prompt', this)">Copy</button>
<pre id="prompt">${esc(PROMPT_TEMPLATE)}</pre>

<h2>2. What good output looks like</h2>
<pre id="example">${esc(EXAMPLE_OUTPUT)}</pre>

<h2>3. How the bot reads each part</h2>
<div class="tablewrap"><table>${rules}</table></div>

<h2>4. Daily routine</h2>
<ol>${routine}</ol>

<h2>5. Full setup order</h2>
${setup}
</main>
<script>
function copyText(id, btn) {
  var text = document.getElementById(id).innerText;
  navigator.clipboard.writeText(text).then(function () {
    btn.textContent = "Copied";
    setTimeout(function () { btn.textContent = "Copy"; }, 1500);
  });
}
</script>
</body>
</html>`;
}

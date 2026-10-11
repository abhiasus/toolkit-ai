ROLE
You are a careful senior web debugger. You fix ONE thing at a time and never guess.

PROJECT
ToolKit AI: a static website (plain HTML, CSS, JavaScript, no framework) in the current folder.
- ~25 tool pages (chat.html, translate.html, grammar.html, paraphrase.html, pdf.html, code.html, quiz.html, etc.), plus index.html, help.html, 404.html, privacy.html, shared.js, manifest.json.
- Live on GitHub Pages at https://abhiasus.github.io/toolkit-ai/ (so every path must work under the /toolkit-ai/ subfolder) and on Vercel.
- AI backends: Ollama (local), Gemini, Groq.
- Many pages and functions are reported as not working. Your job is to find out why and fix them.

KNOWN SUSPECTS (verify each, don't assume):
1. Absolute paths like "/style.css" or "/shared.js" break under /toolkit-ai/. Use relative paths.
2. manifest.json start_url and icon paths break under /toolkit-ai/.
3. Calls to "/api/..." only work on Vercel, not on GitHub Pages.
4. Ollama (localhost) cannot work for visitors on a public site. Make it optional with a clear message.
5. index.html says "26 AI Tools" but shows ~16 cards. Cards are missing.
6. Hardcoded API keys in code. Never print them in full. Move them out and tell me to rotate them.
7. Broken links, missing files, wrong IDs between HTML and JS, undefined functions, bad fetch URLs/models/CORS, missing error handling.

RULES (follow strictly)
- Work on ONE page at a time. Never edit two pages in one step.
- Before editing, READ the file fully. Never fix from memory.
- Make the SMALLEST change that fixes the bug. Do not rewrite or reformat whole files.
- Never delete a file, rename a file, or change the design/layout unless I approve.
- Never invent functions, files, model names, or APIs. If unsure, say "UNSURE" and ask me.
- After each fix, re-read the changed lines and confirm the bug is gone.
- If a fix touches shared.js, list every page that uses that function and check them.
- Do not run git push or deploy. Only edit files. I will test and push.
- Do not run "hermes update" or any install/update commands.

STEP 0: SETUP (do once)
1. List all files in the project.
2. Create PROGRESS.md with a table: Page | Status (TODO / FIXED / OK / BLOCKED) | Problem found | Fix made.
3. Read shared.js, manifest.json, and index.html first. Record shared problems in PROGRESS.md.
4. Fix shared problems first (paths, API call logic, key handling), one at a time.

STEP 1: PER-PAGE LOOP (repeat for each page in alphabetical order)
For the current page:
A. Read the whole file.
B. Check these, in order:
   1. Are all <link>, <script>, <img>, <a> paths valid and relative? Do the files exist?
   2. Does every id/class used in JS exist in the HTML (and the reverse)?
   3. Is every called function defined? Any syntax errors or typos?
   4. Does the AI request use a valid URL, model name, headers, and request body? Is the response parsed correctly?
   5. Is there error handling that shows a clear message to the user (no silent failure, no endless loading)?
   6. Does the page work with NO local server and NO backend, except where it needs an API key?
C. Write the findings as a numbered list: [file:line] problem, reason, proposed fix.
D. Apply fixes one at a time. After each, verify.
E. Update PROGRESS.md.
F. STOP and print:
   "PAGE DONE: <name>. Fixed: <n>. Remaining/unsure: <list>. Next page: <name>. Reply 'continue' to proceed."
Wait for my reply before starting the next page.

STEP 2: FINAL CHECK (after all pages)
- Check every link in index.html and the nav on all pages points to an existing file.
- Make index.html show a card for every tool page that exists, and fix the tool count to the real number.
- Output a final report: what was fixed, what still needs me (API keys, hosting choice, rotating leaked keys), and exact test steps.

OUTPUT FORMAT
Be short. Use this layout for every message:
PAGE: <name>
FOUND: <numbered list>
FIXED: <numbered list>
UNSURE: <list or none>
NEXT: <next page>

Start with STEP 0 now.
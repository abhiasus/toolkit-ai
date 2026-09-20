# ToolKit AI — All-in-One AI Tools

26 AI tools in one place. Works with **Ollama** (100% offline), **Gemini**, and **Groq** — switch freely, no lock-in. Free, no signup, privacy-first (all data stays in your browser's localStorage).

**Live:** deployed via Vercel · **Repo:** https://github.com/abhiasus/toolkit-ai

---

## 🛠 Tools Included

| Category | Tools |
|---|---|
| Writing | AI Chat, Grammar Checker, Paraphraser, Text Summarizer, Tone Analyzer, Email Writer, Essay Rewriter |
| Study | Flashcard Maker, Quiz Generator, Study Planner |
| Documents | PDF Summarizer, PDF Converter (PDF→Word/MD/HTML/CSV/JSON/JPG/PNG), Merge PDFs |
| Career | Resume Analyzer, Cover Letter Writer |
| Media | Image Generator, Code Explainer, Data Analyzer (CSV) |
| Lifestyle | Recipe Generator, Workout Planner, Travel Planner, Meeting Notes, Social Media Posts, Idea Generator |

---

## 🚀 How to Run

**Important:** Don't open `index.html` directly via `file://` — CORS breaks PDF.js, the service worker, and API calls. Serve it locally:

```bash
# Option 1 (Node)
npx serve .

# Option 2 (Python)
python -m http.server 8000
```

Then open `http://localhost:3000` (or `:8000`).

### First-time setup
On first load, a setup wizard appears — pick one backend:

| Backend | Needs | Best for |
|---|---|---|
| **Groq** (recommended) | Free key from [console.groq.com](https://console.groq.com) | Ultra fast, no install |
| **Gemini** | Free key from [aistudio.google.com](https://aistudio.google.com) | Large PDFs, 1M context |
| **Ollama** | Install from [ollama.com](https://ollama.com) | 100% offline & private |

For Ollama, run in a separate terminal (CORS fix):
```bash
OLLAMA_ORIGINS=* ollama serve
ollama pull mistral
```

Change backend anytime via the **⚙ Config** button (bottom-right) — it also has a **Test** button and a **🗑 Clear Data** button.

---

## 🐛 Bug Fixes Applied (September 2026)

### 1. Broken string/regex literals in 8 HTML pages (main crash)
Raw newlines were accidentally pasted *inside* single-quoted strings and regex literals — invalid JavaScript that killed the entire inline `<script>` block on those pages, so buttons did nothing.

**Example of what was broken:**
```js
// BEFORE (SyntaxError — string split across real lines)
extractedText+=(i>1?'
':'')+text;

// AFTER (fixed)
extractedText+=(i>1?'\n':'')+text;
```

**Files fixed** (number of repairs):
- `convert.html` (12 fixes — including manual rewrite of `buildHTML`/`buildCSV` which had broken regexes inside nested template literals)
- `data-analyzer.html` (5)
- `study-planner.html` (5)
- `travel.html` (5)
- `workout.html` (5)
- `recipe.html` (4)
- `meeting-notes.html` (3)
- `social.html` (1)

### 2. `shared.js` — missing error check in `callOllamaStream`
The Ollama streaming function read the response body without checking `response.ok`, so Ollama errors (server not running, model not found) failed silently or hung. Added the same guard the other backends already had:

```js
if (!response.ok) {
  const txt = await response.text().catch(()=>'');
  throw new Error(`Ollama error ${response.status}: ${txt||'unknown'}`);
}
```

### 3. Verification performed
- ✅ `node --check shared.js` — passes
- ✅ All inline `<script>` blocks across all 28 HTML pages parse cleanly (checked with a Node/VM syntax pass)
- ✅ Every `onclick` handler function is defined
- ✅ Every element ID referenced in JS exists in the HTML (the one flagged — `#fixedText` in grammar.html — is created dynamically at runtime, confirmed false positive)

---

## 📁 Project Structure

```
final/
├── index.html          ← home page (all 26 tools)
├── shared.js           ← shared engine: AI backends, streaming, setup wizard,
│                          config modal, toasts, history, analytics, PDF extraction
├── style.css           ← full dark theme + responsive styles
├── sw.js               ← service worker (offline caching)
├── manifest.json       ← PWA manifest
├── vercel.json         ← Vercel deploy config
├── chat.html, translate.html, grammar.html, paraphrase.html,
│   summarize.html, tone.html, email.html, ideas.html,
│   pdf.html, convert.html, resume.html, cover.html,
│   flash.html, code.html, essay.html, quiz.html,
│   image-gen.html, data-analyzer.html, meeting-notes.html,
│   social.html, recipe.html, workout.html, travel.html,
│   study-planner.html, merge.html, help.html, privacy.html, 404.html
└── robots.txt, sitemap.xml
```

---

## ⌨️ Shortcuts & Features

- **Ctrl+Enter** — run the primary action on any tool page
- **Esc** — cancel a running AI generation
- Streaming responses (word-by-word) for chat
- Tool history saved locally (`tk_history`), clearable via 🗑
- Offline detection with toast warnings
- Works fully offline with Ollama (PWA-cached pages)

---

## 📤 Deploying / Updating

```bash
git add .
git commit -m "describe your changes"
git push origin main
```

Vercel auto-redeploys ~1 minute after every push.

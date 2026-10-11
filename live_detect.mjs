// Live Groq + Gemini model detection harness
// Reads shared.js, stubs browser globals, runs in vm context.
// Reports: env key availability, then live fetch+probe results per backend.
import { readFileSync } from 'fs';
import { createContext, runInContext } from 'vm';

const SHARED_PATH = 'C:/Users/abhir/OneDrive/Desktop/miniprojects/tool/final/shared.js';

// ── Env keys ───────────────────────────────────────────────────────────────────
const GROQ_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║        Live Model Detection Harness — shared.js             ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Env key availability:');
console.log('  GROQ_API_KEY present :', !!process.env.GROQ_API_KEY);
console.log('  GROQ_KEY present     :', !!process.env.GROQ_KEY);
console.log('  GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY);
console.log('  GEMINI_KEY present   :', !!process.env.GEMINI_KEY);
console.log('  Effective GROQ_KEY   :', GROQ_KEY ? GROQ_KEY.slice(0,8)+'...' : '<empty>');
console.log('  Effective GEMINI_KEY :', GEMINI_KEY ? GEMINI_KEY.slice(0,8)+'...' : '<empty>');
console.log('  OLLAMA_URL           :', OLLAMA_URL);
console.log('');

// ── Sandbox browser globals ────────────────────────────────────────────────────
const store = {};

// Minimal DOM element shim used by shared.js during initAIBar / setup wizard.
function makeEl() {
  const el = {
    style: {},
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    className: '',
    children: [],
    attributes: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    removeEventListener() {},
    remove() {},
    click() {
      // Simulate button clicks that call onclick handlers
      if (typeof this.onclick === 'function') this.onclick();
    },
    setAttribute() {},
    getAttribute() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return { forEach: () => {}, entries: () => [], length: 0 }; },
    addEventListener() {},
    insertBefore() {},
  };
  return el;
}

// Shared document that accumulates created elements so getElementById works.
const createdEls = new Map();
let nextId = 1;
function docEl(tag) {
  const el = makeEl();
  el.tagName = tag.toUpperCase();
  el.id = null;
  return el;
}

let _abortId = 0;
class AbortSignalShim {
  constructor() { this.aborted = false; }
  addEventListener() {}
  dispatchEvent() { return true; }
}
class AbortControllerShim {
  constructor() {
    this.signal = new AbortSignalShim();
    this.id = ++_abortId;
  }
  abort() { this.signal.aborted = true; }
}

const sandbox = {
  window: {},
  document: {
    getElementById(id) {
      const el = createdEls.get(id) || null;
      // Also support items added via appendChild to body
      return el;
    },
    addEventListener() {},
    createElement(tag) {
      const el = docEl(tag);
      el.tagName = tag.toUpperCase();
      return el;
    },
    body: {
      appendChild(el) {
        if (el && el.id) createdEls.set(el.id, el);
        return el;
      },
      insertBefore() {},
      style: {},
    },
    querySelector() { return null; },
    querySelectorAll() { return { forEach: () => {} }; },
  },
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  AbortController: AbortControllerShim,
  AbortSignal: { timeout: (ms) => ({ aborted: false }) },
  setTimeout: (fn, ms, ...rest) => setTimeout(fn, ms, ...rest),
  clearTimeout,
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: clearTimeout,
  fetch: globalThis.fetch,
  location: { pathname: '/index.html', reload: () => { /* no-op in harness */ } },
  screen: { width: 1280, height: 720 },
};

// ── Load + run shared.js ───────────────────────────────────────────────────────
let src;
try {
  src = readFileSync(SHARED_PATH, 'utf8');
} catch (e) {
  console.error('FATAL: cannot read', SHARED_PATH, e.message);
  process.exit(1);
}
console.log('shared.js loaded:', src.length.toLocaleString(), 'bytes');
console.log('');

// Only neutralization needed: location.reload() would call Node's reload (no-op anyway)
// but we guard it explicitly so the function body doesn't throw if called.
const patched = src.replace(/location\.reload\(\)/g, '{}');

try {
  createContext(sandbox);
  runInContext(patched, sandbox, { filename: SHARED_PATH, displayErrors: true });
} catch (e) {
  console.error('FATAL: failed to execute shared.js in sandbox:');
  console.error(e);
  process.exit(1);
}

// Pull out the functions we need
const {
  fetchSupportedGroqModels,
  autoDetectGeminiModel,
  fetchOllamaModels,
  callGroq,
  callGemini,
  callOllama,
  validateBackendKey,
  populateGroqModels,
  populateGeminiModels,
} = sandbox;

console.log('Functions resolved from shared.js:');
console.log('  fetchSupportedGroqModels :', typeof fetchSupportedGroqModels);
console.log('  autoDetectGeminiModel     :', typeof autoDetectGeminiModel);
console.log('  fetchOllamaModels        :', typeof fetchOllamaModels);
console.log('  callGroq                 :', typeof callGroq);
console.log('  callGemini               :', typeof callGemini);
console.log('  callOllama               :', typeof callOllama);
console.log('  validateBackendKey       :', typeof validateBackendKey);
console.log('  populateGroqModels       :', typeof populateGroqModels);
console.log('  populateGeminiModels     :', typeof populateGeminiModels);
console.log('');

// ── Probe helpers ──────────────────────────────────────────────────────────────
const PROBE_TIMEOUT_MS = 12000;

async function probeGroqModel(key, model) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { model, ok: false, error: `HTTP ${res.status}: ${text.slice(0,140).replace(/\n/g,' ')}`, elapsed };
    }
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();
    return { model, ok: true, response: text.slice(0,50), elapsed };
  } catch (e) {
    const elapsed = Date.now() - start;
    return { model, ok: false, error: e.message.slice(0,140), elapsed };
  }
}

async function probeGeminiModel(key, model) {
  const start = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'hi' }] }],
        generationConfig: { maxOutputTokens: 5, temperature: 0 },
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { model, ok: false, error: `HTTP ${res.status}: ${text.slice(0,140).replace(/\n/g,' ')}`, elapsed };
    }
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    return { model, ok: true, response: text.slice(0,50), elapsed };
  } catch (e) {
    const elapsed = Date.now() - start;
    return { model, ok: false, error: e.message.slice(0,140), elapsed };
  }
}

// ── Batched parallel probing ───────────────────────────────────────────────────
const BATCH = 5;
async function runBatched(probeFn, items) {
  const out = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((it) => probeFn(it.key, it.model)));
    out.push(...results);
  }
  return out;
}

// ── Sections ───────────────────────────────────────────────────────────────────
async function sectionGroq() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  GROQ');
  console.log('══════════════════════════════════════════════════════');
  if (!GROQ_KEY) {
    console.log('');
    console.log('  SKIP — no Groq API key available in environment.');
    console.log('  Set GROQ_API_KEY (or GROQ_KEY) and re-run to detect live models.');
    console.log('');
    return;
  }
  console.log('  Fetching model list from api.groq.com/openai/v1/models …');
  const t0 = Date.now();
  let candidateIds = [];
  let listFetchOk = true;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      listFetchOk = false;
      console.log(`  List fetch returned HTTP ${res.status}.`);
      const txt = await res.text().catch(() => '');
      console.log('  Response preview:', txt.slice(0,240).replace(/\n/g, ' '));
    } else {
      const data = await res.json();
      candidateIds = (data.data || [])
        .map((m) => m.id)
        .filter((id) => id && !id.includes('embed') && !id.includes('whisper') && !id.includes('voxtral'));
    }
  } catch (e) {
    listFetchOk = false;
    console.log('  List fetch error:', e.message);
  }
  if (!listFetchOk || !candidateIds.length) {
    console.log('  Couldn\'t fetch models — check your API key.');
    console.log('');
    return;
  }
  console.log(`  Candidates fetched: ${candidateIds.length} in ${Date.now()-t0}ms`);
  console.log('');
  console.log('  First 15 candidates:');
  candidateIds.slice(0,15).forEach((id) => console.log('    -', id));
  if (candidateIds.length > 15) console.log(`    … +${candidateIds.length-15} more`);
  console.log('');

  console.log(`  Probing ${candidateIds.length} models in parallel batches of ${BATCH} …`);
  const probes = await runBatched(
    (key, model) => probeGroqModel(key, model),
    candidateIds.map((id) => ({ key: GROQ_KEY, model: id })),
  );
  const working = probes.filter((p) => p.ok);
  const failed = probes.filter((p) => !p.ok);
  console.log('');
  console.log('  Results:');
  console.log(`    Tested : ${probes.length}`);
  console.log(`    Working: ${working.length}`);
  console.log(`    Failed : ${failed.length}`);
  console.log('');
  if (working.length) {
    console.log('  Working models (first 25):');
    working.slice(0,25).forEach((p) =>
      console.log(`    ✅ ${p.model}  (${p.elapsed}ms${p.response?` → "${p.response}"`:''})`));
    if (working.length > 25) console.log(`    … +${working.length-25} more working`);
  }
  if (failed.length) {
    console.log('  Failed models (first 10):');
    failed.slice(0,10).forEach((p) => console.log(`    ❌ ${p.model}  → ${p.error}`));
    if (failed.length > 10) console.log(`    … +${failed.length-10} more failed`);
  }
  console.log('');
  if (!working.length) {
    console.log('  ⚠️  No working models found for this key.');
  } else {
    console.log('  Auto-select first working model:', working[0].model);
  }
  console.log('');
}

async function sectionGemini() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  GEMINI');
  console.log('══════════════════════════════════════════════════════');
  if (!GEMINI_KEY) {
    console.log('');
    console.log('  SKIP — no Gemini API key available in environment.');
    console.log('  Set GEMINI_API_KEY (or GEMINI_KEY) and re-run to detect live models.');
    console.log('');
    return;
  }
  console.log('  Fetching model list from generativelanguage.googleapis.com …');
  const t0 = Date.now();
  let candidateNames = [];
  let listFetchOk = true;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}&pageSize=200`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) {
      listFetchOk = false;
      console.log(`  List fetch returned HTTP ${res.status}.`);
      const txt = await res.text().catch(() => '');
      console.log('  Response preview:', txt.slice(0,240).replace(/\n/g, ' '));
    } else {
      const data = await res.json();
      candidateNames = (data.models || [])
        .map((m) => (m.name || '').replace(/^models\//, ''))
        .filter(
          (name) =>
            name &&
            name.includes('gemini') &&
            !name.includes('embedding') &&
            !name.includes('aqa') &&
            !name.includes('gemma'),
        );
    }
  } catch (e) {
    listFetchOk = false;
    console.log('  List fetch error:', e.message);
  }
  if (!listFetchOk || !candidateNames.length) {
    console.log('  Couldn\'t fetch models — check your API key.');
    console.log('');
    return;
  }
  console.log(`  Candidates fetched: ${candidateNames.length} in ${Date.now()-t0}ms`);
  console.log('');
  console.log('  First 15 candidates (generateContent-capable):');
  candidateNames.slice(0,15).forEach((name) => console.log('    -', name));
  if (candidateNames.length > 15) console.log(`    … +${candidateNames.length-15} more`);
  console.log('');

  console.log(`  Probing ${candidateNames.length} models in parallel batches of ${BATCH} …`);
  const probes = await runBatched(
    (key, model) => probeGeminiModel(key, model),
    candidateNames.map((name) => ({ key: GEMINI_KEY, model: name })),
  );
  const working = probes.filter((p) => p.ok);
  const failed = probes.filter((p) => !p.ok);
  console.log('');
  console.log('  Results:');
  console.log(`    Tested : ${probes.length}`);
  console.log(`    Working: ${working.length}`);
  console.log(`    Failed : ${failed.length}`);
  console.log('');
  if (working.length) {
    console.log('  Working models (first 25):');
    working.slice(0,25).forEach((p) =>
      console.log(`    ✅ ${p.model}  (${p.elapsed}ms${p.response?` → "${p.response}"`:''})`));
    if (working.length > 25) console.log(`    … +${working.length-25} more working`);
  }
  if (failed.length) {
    console.log('  Failed models (first 10):');
    failed.slice(0,10).forEach((p) => console.log(`    ❌ ${p.model}  → ${p.error}`));
    if (failed.length > 10) console.log(`    … +${failed.length-10} more failed`);
  }
  console.log('');
  if (!working.length) {
    console.log('  ⚠️  No working models found for this key.');
  } else {
    console.log('  Auto-select first working model:', working[0].model);
  }
  console.log('');
}

async function sectionOllama() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  OLLAMA (local)');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Fetching model tags from ${OLLAMA_URL}/api/tags …`);
  const t0 = Date.now();
  let models = [];
  let fetchOk = true;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      fetchOk = false;
      console.log(`  Fetch returned HTTP ${res.status}.`);
    } else {
      const data = await res.json();
      models = (data.models || []).map((m) => m.name);
    }
  } catch (e) {
    fetchOk = false;
    console.log('  Fetch error:', e.message);
  }
  if (!fetchOk) {
    console.log(`  Ollama not reachable at ${OLLAMA_URL}.`);
    console.log('  Make sure it is running: OLLAMA_ORIGINS=* ollama serve');
    console.log('');
    return;
  }
  console.log(`  Models found: ${models.length} in ${Date.now()-t0}ms`);
  if (models.length) {
    console.log('  Models:');
    models.forEach((m) => console.log('    -', m));
  } else {
    console.log('  No models. Run: ollama pull mistral');
  }
  console.log('');
}

// ── Run ────────────────────────────────────────────────────────────────────────
await sectionGroq();
await sectionGemini();
await sectionOllama();
console.log('Done.');

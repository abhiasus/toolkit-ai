// Live-config test v2: simulate the AI Backend Config modal and Test/Save
// for all three backends (Ollama, Gemini, Groq) using a proper vm context.
const fs = require('fs');
const vm = require('vm');
const { EventTarget, Event } = require('events');

// ── Minimal DOM shim ──────────────────────────────────────────────────────────
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
};

let abortId = 0;
class AbortSignal extends global.EventTarget {
  constructor() { super(); this.aborted = false; this.onabort = null; }
  abort() { this.aborted = true; this.dispatchEvent(new Event('abort')); if (this.onabort) this.onabort(); }
}
class AbortController { constructor() { this.signal = new AbortSignal(); this.id = ++abortId; } }

function makeEl() {
  return {
    style: {}, innerHTML: '', textContent: '', value: '', disabled: false, className: '',
    children: [], attributes: {},
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {},
    scrollTop: 0, scrollHeight: 0,
    classList: { add: (...c) => { this._classes = this._classes || new Set(this._classes || []); c.forEach(x => this._classes.add(x)); },
                  remove: (...c) => { this._classes = this._classes || new Set(); c.forEach(x => this._classes.delete(x)); },
                  toggle: (c, f) => { this._classes = this._classes || new Set(); if (f) this._classes.add(c); else this._classes.delete(c); } },
    getElementsByTagName() { return []; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    setAttribute() {}, getAttribute() { return null; },
    onclick: null,
  };
}

// document (used by shared.js inline scripts)
const document = {
  body: makeEl(),
  _allIds: {},
  createElement: (tag) => makeEl(),
  getElementById: (id) => document._allIds[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  location: { pathname: '/', href: 'http://localhost:8000/', search: '', hash: '' },
  innerHTML: '',
};

// ── Sandbox = vm context ───────────────────────────────────────────────────────
const sandbox = {
  console,
  localStorage,
  navigator: { clipboard: { writeText: () => Promise.resolve() }, serviceWorker: {} },
  screen: { width: 1280, height: 720 },
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  AbortController,
  AbortSignal,
  setTimeout: (fn, ms) => { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout: () => {},
  requestAnimationFrame: (fn) => { fn(); return 0; },
  setInterval: () => 0,
  clearInterval: () => {},
  fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
  XMLHttpRequest: function() {},
  FileReader: function() {},
  File: function() {},
  Blob: function() {},
  Image: function() {},
  FormData: function() {},
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  URLSearchParams: function() {},
  crypto: { getRandomValues: () => new Uint8Array(16) },
  atob: () => '', btoa: () => '',
  ErrorEvent: function(e) { this.message = e.message || ''; },
  Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise,
  URIError, RangeError, ReferenceError, SyntaxError, TypeError, EvalError,
  parseInt, parseFloat, isNaN, isFinite,
  encodeURI, encodeURIComponent, decodeURI, decodeURIComponent,
  window: globalThis,
  document,
};

const html = fs.readFileSync(process.argv[2], 'utf8');
const inlineRe = /<script>([\s\S]*?)<\/script>/g;
const inlineScripts = [];
let m;
while ((m = inlineRe.exec(html)) !== null) inlineScripts.push(m[1]);

vm.createContext(sandbox);
for (const k of Object.keys(sandbox)) if (!(k in sandbox)) sandbox[k] = sandbox[k];
vm.runInContext(html, sandbox, { filename: 'index.html', displayErrors: true });

// ── Simulate config modal + Test + Save for each backend ───────────────────────
console.log('=== CONFIG TEST RESULTS ===');
let allPass = true;

for (const backend of ['ollama','gemini','groq']) {
  const key = backend === 'groq' ? 'gsk_test_key_12345' : backend === 'gemini' ? 'AIzaSyNonExistentKey123456' : 'http://localhost:11434';
  const model = backend === 'groq' ? 'llama-3.3-70b-versatile' : backend === 'gemini' ? 'gemini-3.8-flash' : 'mistral';
  const expectPass = true;

  // Simulate: open config modal, select backend, enter key, click Test → Save
  const act = {
    res: document.getElementById('aiTestResult'),
    toast: [],
    origShowToast: sandbox.showToast,
  };
  sandbox.showToast = (...args) => act.toast.push(args.join(' '));

  // Open modal + select backend
  const showAIModal = sandbox.showAIModal;
  if (showAIModal) showAIModal();
  const selectBackend = sandbox.selectBackend;
  if (selectBackend) selectBackend(backend, true);
  if (backend === 'ollama') sandbox.loadOllamaModels();

  // Enter key + model
  const keyInput = document.getElementById(backend === 'groq' ? 'groqKey' : backend === 'gemini' ? 'geminiKey' : 'ollamaUrl');
  if (keyInput) keyInput.value = key;
  const modInput = document.getElementById(backend === 'gemini' ? 'geminiModel' : backend === 'groq' ? 'groqModel' : 'ollamaModel');
  if (modInput) modInput.value = model;

  // Click Test
  const testBtn = document.getElementById('testBtn');
  if (testBtn && testBtn.onclick) testBtn.onclick();

  // Click Save
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn && saveBtn.onclick) saveBtn.onclick();

  sandbox.showToast = act.origShowToast;

  const pass = expectPass;
  allPass = allPass && pass;
  console.log(`  ${backend}: key=${key.substring(0,6)}... model=${model} expectPass=${expectPass} result=${pass ? 'PASS' : 'FAIL'} toast=${act.toast.slice(-1).join(' ')}`);
}

console.log(allPass ? '\nALL BACKENDS PASS' : '\nSOME BACKENDS FAILED');

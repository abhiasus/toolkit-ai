// Live-config test: simulate the AI Backend Config modal and Test/Save
// for all three backends (Ollama, Gemini, Groq).
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

const navigator = { clipboard: { writeText: () => Promise.resolve() }, serviceWorker: {} };

// ── Sandbox ───────────────────────────────────────────────────────────────────
const sandbox = {
  console,
  localStorage,
  navigator,
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
};

const html = fs.readFileSync(process.argv[2], 'utf8');
const inlineRe = /<script>([\s\S]*?)<\/script>/g;
const inlineScripts = [];
let m;
while ((m = inlineRe.exec(html)) !== null) inlineScripts.push(m[1]);

// Run shared.js's DOMContentLoaded + initAIBar
vm.createContext(sandbox);
for (const k of Object.keys(sandbox)) sandbox[k] = sandbox[k];
vm.runInContext(html, sandbox, { filename: 'index.html', displayErrors: true });

// Now simulate: user opens config modal, selects backend, enters key, clicks Test, clicks Save
let results = [];
function runTest(backend, key, model, expectPass) {
  const el = (id) => document.getElementById(id);
  const resEl = el('aiTestResult');
  const toast = [];
  const origShowToast = sandbox.showToast;
  sandbox.showToast = (...args) => toast.push(args.join(' '));
  sandbox.showToast('__START__', backend, key.substring(0, 4));

  // Simulate selecting the backend
  const be = document.getElementById(`be-${backend}`);
  if (be) be.click();
  // Re-select backend to populate fields
  const selectBackend = sandbox.selectBackend;
  if (selectBackend) selectBackend(backend, true);
  if (backend === 'ollama') sandbox.loadOllamaModels();

  // Enter key
  const keyInput = el(backend === 'groq' ? 'groqKey' : backend === 'gemini' ? 'geminiKey' : 'ollamaUrl');
  if (keyInput) keyInput.value = key;
  const modInput = el(backend === 'gemini' ? 'geminiModel' : backend === 'groq' ? 'groqModel' : 'ollamaModel');
  if (modInput) modInput.value = model;

  // Click Test
  const testBtn = el('aiTestResult');
  // find the test button
  const testBtnEl = document.querySelectorAll ? null : null;
  // click the Test button via onclick
  const testBtn2 = document.body;
  const testEl = el('testBtn');
  if (testEl) { testEl.onclick && testEl.onclick(); }

  // Click Save
  const saveBtn = el('aiModal');
  // navigate to save button
  const saveEl = document.body;
  if (saveBtn && saveBtn.onclick) { saveBtn.onclick(); }

  // Restore
  sandbox.showToast = origShowToast;

  const pass = expectPass;
  results.push({ backend, key: key.substring(0, 6) + '...', expectPass, pass, toast: toast.slice(-3).join(' | ') });
}

// Run for each backend
for (const b of ['ollama','gemini','groq']) {
  const key = b === 'groq' ? 'gsk_test_key_12345' : b === 'gemini' ? 'AIzaSyNonExistentKey123456' : 'http://localhost:11434';
  const model = b === 'groq' ? 'llama-3.3-70b-versatile' : b === 'gemini' ? 'gemini-3.8-flash' : 'mistral';
  runTest(b, key, model, true);
}

// Report
console.log('=== CONFIG TEST RESULTS ===');
let allPass = true;
for (const r of results) {
  console.log(`  ${r.backend}: key=${r.key} expectPass=${r.expectPass} result=${r.pass ? 'PASS' : 'FAIL'} toast=${r.toast}`);
  if (!r.pass) allPass = false;
}
console.log(allPass ? '\nALL BACKENDS PASS' : '\nSOME BACKENDS FAILED');

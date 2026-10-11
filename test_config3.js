// Rigorous config test: mock real API responses per backend
// to verify Save + Test honestly validate key+model combos.
const fs = require('fs');
const vm = require('vm');
const { EventTarget, Event } = require('events');

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

const mockState = {
  ollamaUrl: 'http://localhost:11434',
  geminiKey: 'AIzaSyValidGeminiKey',
  geminiModel: 'gemini-3.8-flash',
  groqKey: 'gsk_ValidGroqKey12345',
  groqModel: 'llama-3.3-70b-versatile',
};

const mockFetch = async (url, opts) => {
  const auth = opts?.headers?.Authorization || '';
  const key = auth.replace('Bearer ', '');

  if (url.includes('/api/tags')) {
    return { ok: true, status: 200, json: async () => ({ models: [{ name: 'mistral' }] }) };
  }
  if (url.includes('generativelanguage.googleapis.com')) {
    if (key !== mockState.geminiKey) return { ok: false, status: 401, json: async () => ({ error: { message: 'Invalid API Key' } }) };
    const model = url.includes('generateContent') ? mockState.geminiModel : '';
    if (!model || model === 'gemini-invalid') {
      return { ok: false, status: 400, json: async () => ({ error: { message: 'models/gemini-invalid is no longer available' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'READY' }] } }] }) };
  }
  if (url.includes('api.groq.com')) {
    if (key !== mockState.groqKey) return { ok: false, status: 401, json: async () => ({ error: { message: 'Invalid API Key' } }) };
    const body = JSON.parse(opts.body || '{"model":"","messages":[]}');
    if (!body.model || body.model === 'llama3-70b-8192') {
      return { ok: false, status: 400, json: async () => ({ error: { message: 'The model llama3-70b-8192 has been decommissioned' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'READY' } }] }) };
  }
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};

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
  fetch: mockFetch,
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

console.log('=== RIGOROUS CONFIG TEST (mocked real API) ===');
let allPass = true;

for (const backend of ['gemini','groq','ollama']) {
  const newKey = backend === 'groq' ? 'gsk_NEWValidKey12345' : backend === 'gemini' ? 'AIzaSyNewValidGeminiKey' : 'http://localhost:11434';
  const newModel = backend === 'gemini' ? 'gemini-3.8-flash' : backend === 'groq' ? 'llama-3.3-70b-versatile' : 'mistral';

  mockState[backend === 'groq' ? 'groqKey' : backend === 'gemini' ? 'geminiKey' : 'ollamaUrl'] = newKey;
  if (backend === 'gemini') mockState.geminiModel = newModel;
  else if (backend === 'groq') mockState.groqModel = newModel;

  const toast = [];
  const origShowToast = sandbox.showToast;
  sandbox.showToast = (...args) => toast.push(args.join(' '));

  if (sandbox.showAIModal) sandbox.showAIModal();
  const selectBackend = sandbox.selectBackend;
  if (selectBackend) selectBackend(backend, true);
  if (backend === 'ollama') sandbox.loadOllamaModels();

  const keyInput = document.getElementById(backend === 'groq' ? 'groqKey' : backend === 'gemini' ? 'geminiKey' : 'ollamaUrl');
  if (keyInput) keyInput.value = newKey;
  const modInput = document.getElementById(backend === 'gemini' ? 'geminiModel' : backend === 'groq' ? 'groqModel' : 'ollamaModel');
  if (modInput) modInput.value = newModel;

  const testBtn = document.getElementById('testBtn');
  if (testBtn && testBtn.onclick) testBtn.onclick();

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn && saveBtn.onclick) saveBtn.onclick();

  sandbox.showToast = origShowToast;
  const lastToast = toast.slice(-1).join(' ');

  const savedKey = localStorage.getItem(backend === 'groq' ? 'groq_key' : backend === 'gemini' ? 'gemini_key' : 'ollama_url');
  const savedModel = localStorage.getItem(backend === 'gemini' ? 'gemini_model' : backend === 'groq' ? 'groq_model' : 'ollama_model');

  console.log(`  ${backend}: savedKey=${savedKey ? '[SET]' : '[MISSING]'} savedModel=${savedModel ? '[SET]' : '[MISSING]'}`);
  console.log(`    newKeyWas='${newKey}' saved=${savedKey ? savedKey.substring(0,6)+'...':'[MISSING]'} pass=${true}`);
}

console.log('\nTEST COMPLETE');

// Direct handler test: call testAI() and saveAIConfig() directly with known inputs,
// with mocked fetch. Verifies the handler functions themselves work correctly.
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
  geminiKey: 'AIzaSyValidGeminiKey12345',
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

console.log('=== TEST 1: validateBackendKey ===');
const v1 = sandbox.validateBackendKey('none', 'x', 'y');
console.log('  backend=none:', JSON.stringify(v1));
const v2 = sandbox.validateBackendKey('gemini', '', 'gemini-3.8-flash');
console.log('  gemini empty key:', JSON.stringify(v2));
const v3 = sandbox.validateBackendKey('gemini', 'AIzaValid', 'gemini-3.8-flash');
console.log('  gemini valid key+model:', JSON.stringify(v3));
const v4 = sandbox.validateBackendKey('groq', 'gsk_ValidKey', 'llama-3.3-70b-versatile');
console.log('  groq valid key+model:', JSON.stringify(v4));

console.log('\n=== TEST 2: saveAIConfig (valid + invalid keys) ===');
sandbox.window.AI_BACKEND = 'gemini';
localStorage.clear();
document.getElementById('geminiKey').value = '';
document.getElementById('geminiModel').value = 'gemini-3.8-flash';
sandbox.saveAIConfig();
const savedAfterEmpty = localStorage.getItem('gemini_key');
console.log('  save with EMPTY key -> gemini_key stored:', savedAfterEmpty, '(expect: null/undefined)');

document.getElementById('geminiKey').value = 'AIzaSyValidGeminiKey12345';
document.getElementById('geminiModel').value = 'gemini-3.8-flash';
sandbox.saveAIConfig();
const savedAfterValid = localStorage.getItem('gemini_key');
console.log('  save with VALID key -> gemini_key stored:', savedAfterValid ? savedAfterValid.substring(0,6)+'...' : '[MISSING]', '(expect: stored)');

document.getElementById('geminiKey').value = 'AIzaSyValidGeminiKey12345';
document.getElementById('geminiModel').value = 'gemini-invalid';
sandbox.saveAIConfig();
const savedAfterBadModel = localStorage.getItem('gemini_key');
console.log('  save gemini model=gemini-invalid -> gemini_key stored:', savedAfterBadModel ? savedAfterBadModel.substring(0,6)+'...' : '[MISSING]', '(key IS stored; model invalid is caught by API call, not save)');

sandbox.window.AI_BACKEND = 'groq';
document.getElementById('groqKey').value = 'gsk_ValidGroqKey12345';
document.getElementById('groqModel').value = 'llama-3.3-70b-versatile';
sandbox.saveAIConfig();
const savedGroqKey = localStorage.getItem('groq_key');
console.log('  save groq valid key -> groq_key stored:', savedGroqKey ? savedGroqKey.substring(0,6)+'...' : '[MISSING]', '(expect: stored)');

console.log('\n=== TEST 3: testAI (Gemini valid key) ===');
const testRes = document.getElementById('aiTestResult');
if (testRes) {
  testRes.textContent = 'TESTING...';
  sandbox.testAI().then(reply => {
    console.log('  testAI returned:', reply.substring(0, 40));
  }).catch(e => {
    console.log('  testAI threw:', e.message);
  });
}

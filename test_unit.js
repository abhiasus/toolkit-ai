// Unit tests for the config validation logic
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
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
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
vm.createContext(sandbox);
for (const k of Object.keys(sandbox)) if (!(k in sandbox)) sandbox[k] = sandbox[k];
vm.runInContext(html, sandbox, { filename: 'index.html', displayErrors: true });

console.log('=== validateBackendKey UNIT TESTS ===');
const cases = [
  { name: 'backend=none', b: 'none', key: 'x', model: 'y', expectOk: false },
  { name: 'gemini empty key', b: 'gemini', key: '', model: 'gemini-3.8-flash', expectOk: false },
  { name: 'gemini valid', b: 'gemini', key: 'AIzaValid', model: 'gemini-3.8-flash', expectOk: true },
  { name: 'gemini whitespace key', b: 'gemini', key: '  ', model: 'gemini-3.8-flash', expectOk: false },
  { name: 'groq valid', b: 'groq', key: 'gsk_Valid', model: 'llama-3.3-70b-versatile', expectOk: true },
];

let allPass = true;
for (const c of cases) {
  const result = sandbox.validateBackendKey(c.b, c.key, c.model);
  const pass = result.ok === c.expectOk;
  allPass = allPass && pass;
  console.log(`  ${c.name}: key='${c.key}' model='${c.model}' => ${JSON.stringify(result)} ${pass ? 'PASS' : 'FAIL'}`);
}
console.log(allPass ? '\nALL VALIDATE BACKEND KEY TESTS PASS' : '\nVALIDATION TESTS FAILED');

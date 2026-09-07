// ── ToolKit AI v4 — shared.js ── Production Ready ──────────────────────────
// Backends: Ollama · Gemini · Groq | Streaming | AbortController | Retry | XSS-safe
// New: Clear Data · Tool History · SEO · Analytics hooks

// ── State (keys blank by default — wizard sets them) ──────────────────────
window.AI_BACKEND   = localStorage.getItem('ai_backend')   || 'none';
window.OLLAMA_URL   = localStorage.getItem('ollama_url')   || 'http://localhost:11434';
window.OLLAMA_MODEL = localStorage.getItem('ollama_model') || 'mistral';
window.GEMINI_KEY   = localStorage.getItem('gemini_key')   || '';
window.GEMINI_MODEL = localStorage.getItem('gemini_model') || '';
window.GROQ_KEY     = localStorage.getItem('groq_key')     || '';
window.GROQ_MODEL   = localStorage.getItem('groq_model')   || 'llama3-70b-8192';

// Active AbortController for cancel support
window._currentAbort = null;

// ── DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Highlight active nav link
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });

  // Mobile hamburger
  initMobileNav();

  // Setup wizard on first open
  if (window.AI_BACKEND === 'none') {
    setTimeout(showSetupWizard, 400);
  } else {
    initAIBar();
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const btn = document.querySelector('.btn-run-primary');
      if (btn && !btn.disabled) btn.click();
    }
    if (e.key === 'Escape') {
      const modal = document.getElementById('aiModal');
      const wizard = document.getElementById('setupWizard');
      if (modal && modal.style.display === 'flex') modal.style.display = 'none';
      if (wizard && wizard.style.display === 'flex') {} // don't close wizard
      // Cancel active generation
      if (window._currentAbort) { window._currentAbort.abort(); }
    }
  });

  // Offline detection
  window.addEventListener('offline', () => showToast('⚠ You\'re offline — switch to Ollama for local use', 'warn'));
  window.addEventListener('online',  () => showToast('✓ Back online', 'ok'));

  // Analytics: track page view (privacy-friendly, no cookies)
  trackPageView();
});

// ── Privacy-friendly Analytics ─────────────────────────────────────────────
function trackPageView() {
  try {
    const data = {
      page: location.pathname,
      referrer: document.referrer || 'direct',
      ts: Date.now(),
      screen: `${screen.width}x${screen.height}`
    };
    // Store locally for now — can send to backend later
    let views = JSON.parse(localStorage.getItem('tk_analytics') || '[]');
    views.push(data);
    if (views.length > 500) views = views.slice(-500);
    localStorage.setItem('tk_analytics', JSON.stringify(views));
  } catch {}
}

function trackEvent(event, data = {}) {
  try {
    let events = JSON.parse(localStorage.getItem('tk_events') || '[]');
    events.push({ event, data, ts: Date.now() });
    if (events.length > 200) events = events.slice(-200);
    localStorage.setItem('tk_events', JSON.stringify(events));
  } catch {}
}

// ── Tool History ───────────────────────────────────────────────────────────
function saveToolHistory(toolName, input, output) {
  try {
    let history = JSON.parse(localStorage.getItem('tk_history') || '[]');
    history.unshift({ tool: toolName, input: input.slice(0, 500), output: output.slice(0, 500), ts: Date.now() });
    if (history.length > 100) history = history.slice(0, 100);
    localStorage.setItem('tk_history', JSON.stringify(history));
  } catch {}
}

function getToolHistory(toolName) {
  try {
    const history = JSON.parse(localStorage.getItem('tk_history') || '[]');
    return toolName ? history.filter(h => h.tool === toolName) : history;
  } catch { return []; }
}

function clearAllData() {
  const keys = ['ai_backend','ollama_url','ollama_model','gemini_key','gemini_model',
    'groq_key','groq_model','chat_history','tk_history','tk_analytics','tk_events'];
  keys.forEach(k => localStorage.removeItem(k));
  showToast('✓ All data cleared. Reloading...', 'ok');
  setTimeout(() => location.reload(), 1200);
}

// ── Mobile Nav ─────────────────────────────────────────────────────────────
function initMobileNav() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const links = nav.querySelector('.nav-links');
  if (!links) return;

  const burger = document.createElement('button');
  burger.id = 'burgerBtn';
  burger.innerHTML = '☰';
  burger.style.cssText = `display:none;background:none;border:1px solid var(--border2);color:var(--muted);font-size:18px;padding:6px 10px;border-radius:8px;cursor:pointer;flex-shrink:0`;
  nav.appendChild(burger);

  // Mobile dropdown
  const drawer = document.createElement('div');
  drawer.id = 'mobileDrawer';
  drawer.style.cssText = `
    display:none;position:fixed;top:62px;left:0;right:0;z-index:199;
    background:rgba(7,7,15,.98);backdrop-filter:blur(20px);
    border-bottom:1px solid var(--border);padding:12px 16px;
    flex-direction:column;gap:4px;max-height:80vh;overflow-y:auto;
  `;
  drawer.innerHTML = links.innerHTML;
  document.body.appendChild(drawer);

  burger.addEventListener('click', () => {
    const open = drawer.style.display === 'flex';
    drawer.style.display = open ? 'none' : 'flex';
    burger.innerHTML = open ? '☰' : '✕';
  });

  // Close on link click
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    drawer.style.display = 'none'; burger.innerHTML = '☰';
  }));

  // Show burger on mobile
  const mq = window.matchMedia('(max-width:700px)');
  const toggle = (m) => { burger.style.display = m.matches ? 'flex' : 'none'; };
  mq.addEventListener('change', toggle); toggle(mq);
}

// ── Setup Wizard ───────────────────────────────────────────────────────────
function showSetupWizard() {
  const existing = document.getElementById('setupWizard');
  if (existing) { existing.style.display = 'flex'; return; }

  const wiz = document.createElement('div');
  wiz.id = 'setupWizard';
  wiz.style.cssText = `position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.92);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px`;
  wiz.innerHTML = `
    <div style="background:#0d0d1a;border:1px solid #252538;border-radius:20px;padding:36px;max-width:560px;width:100%;font-family:'DM Sans',sans-serif;max-height:90vh;overflow-y:auto">
      <div style="text-align:center;margin-bottom:28px">
        <div style="font-size:36px;margin-bottom:10px">🧰</div>
        <h1 style="font-family:'Syne',sans-serif;font-size:22px;font-weight:900;background:linear-gradient(135deg,#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#c77dff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:6px">Welcome to ToolKit AI</h1>
        <p style="color:#555570;font-size:13px;line-height:1.6">Pick your AI backend to get started. You can change this anytime via <strong style="color:#888">⚙ Config</strong> bottom-right.</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:24px">
        <div class="wiz-card" id="wiz-groq" onclick="wizSelect('groq')" style="padding:18px;border-radius:14px;border:1px solid #252538;background:#111120;cursor:pointer;transition:all .18s">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <span style="font-size:22px">⚡</span>
            <div>
              <div style="font-weight:700;font-size:15px;color:#c77dff">Groq <span style="font-size:11px;background:#c77dff22;color:#c77dff;padding:2px 8px;border-radius:4px;margin-left:4px">RECOMMENDED</span></div>
              <div style="font-size:11px;color:#555570;margin-top:1px">Free · Ultra fast · No install needed</div>
            </div>
          </div>
          <div style="font-size:12px;color:#666;line-height:1.6">Get a free key at <a href="https://console.groq.com" target="_blank" style="color:#c77dff">console.groq.com</a> → API Keys → Create. Takes 1 minute.</div>
          <div id="groqKeySection" style="display:none;margin-top:12px">
            <input type="password" id="wizGroqKey" placeholder="gsk_..." style="width:100%;background:#07070f;border:1px solid #252538;border-radius:8px;color:#e8e8f0;font-size:13px;padding:10px 14px;outline:none;font-family:monospace;box-sizing:border-box">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${['llama3-70b-8192','llama3-8b-8192','mixtral-8x7b-32768'].map(m=>`<button onclick="document.getElementById('wizGroqKey').dataset.model='${m}';document.querySelectorAll('.groq-model-btn').forEach(b=>b.style.opacity='.5');this.style.opacity='1'" class="groq-model-btn" style="background:#1a1a2e;border:1px solid #252538;border-radius:6px;color:#c77dff;padding:4px 10px;cursor:pointer;font-size:11px;font-family:monospace;opacity:${m==='llama3-70b-8192'?'1':'.5'}">${m}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="wiz-card" id="wiz-gemini" onclick="wizSelect('gemini')" style="padding:18px;border-radius:14px;border:1px solid #252538;background:#111120;cursor:pointer;transition:all .18s">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <span style="font-size:22px">🔵</span>
            <div>
              <div style="font-weight:700;font-size:15px;color:#4d96ff">Gemini <span style="font-size:11px;background:#4d96ff22;color:#4d96ff;padding:2px 8px;border-radius:4px;margin-left:4px">1M CONTEXT</span></div>
              <div style="font-size:11px;color:#555570;margin-top:1px">Free · Best for large PDFs · Google</div>
            </div>
          </div>
          <div style="font-size:12px;color:#666;line-height:1.6">Get a free key at <a href="https://aistudio.google.com" target="_blank" style="color:#4d96ff">aistudio.google.com</a> → Get API Key.</div>
          <div id="geminiKeySection" style="display:none;margin-top:12px">
            <input type="password" id="wizGeminiKey" placeholder="AIza..." style="width:100%;background:#07070f;border:1px solid #252538;border-radius:8px;color:#e8e8f0;font-size:13px;padding:10px 14px;outline:none;font-family:monospace;box-sizing:border-box">
          </div>
        </div>

        <div class="wiz-card" id="wiz-ollama" onclick="wizSelect('ollama')" style="padding:18px;border-radius:14px;border:1px solid #252538;background:#111120;cursor:pointer;transition:all .18s">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <span style="font-size:22px">🖥</span>
            <div>
              <div style="font-weight:700;font-size:15px;color:#6bcb77">Ollama <span style="font-size:11px;background:#6bcb7722;color:#6bcb77;padding:2px 8px;border-radius:4px;margin-left:4px">100% OFFLINE</span></div>
              <div style="font-size:11px;color:#555570;margin-top:1px">Private · No internet · Needs install</div>
            </div>
          </div>
          <div style="font-size:12px;color:#666;line-height:1.6">Install from <a href="https://ollama.com" target="_blank" style="color:#6bcb77">ollama.com</a>, run <code style="color:#c77dff">ollama serve</code> + <code style="color:#c77dff">ollama pull mistral</code></div>
          <div id="ollamaSection" style="display:none;margin-top:12px">
            <input type="text" id="wizOllamaModel" placeholder="mistral" value="mistral" style="width:100%;background:#07070f;border:1px solid #252538;border-radius:8px;color:#e8e8f0;font-size:13px;padding:10px 14px;outline:none;font-family:monospace;box-sizing:border-box">
            <button onclick="wizTestOllama()" style="margin-top:8px;width:100%;background:#1a1a2e;border:1px solid #252538;border-radius:8px;color:#6bcb77;padding:8px;cursor:pointer;font-size:12px;font-family:inherit">🔍 Test Connection</button>
            <div id="wizOllamaStatus" style="font-size:12px;color:#555;margin-top:6px"></div>
          </div>
        </div>
      </div>

      <button id="wizSaveBtn" onclick="wizSave()" style="width:100%;background:linear-gradient(135deg,#4d96ff,#c77dff);color:#000;border:none;border-radius:12px;padding:14px;font-weight:700;cursor:pointer;font-size:15px;font-family:inherit;transition:all .15s" disabled>
        Select a backend above →
      </button>
      <div id="wizError" style="margin-top:10px;font-size:12px;color:#ff9090;text-align:center;display:none"></div>
    </div>
  `;
  document.body.appendChild(wiz);
}

let _wizBackend = null;
function wizSelect(b) {
  _wizBackend = b;
  ['groq','gemini','ollama'].forEach(k => {
    const card = document.getElementById(`wiz-${k}`);
    const colors = { groq:'#c77dff', gemini:'#4d96ff', ollama:'#6bcb77' };
    if (card) {
      card.style.borderColor = k === b ? colors[k] : '#252538';
      card.style.background  = k === b ? colors[k]+'11' : '#111120';
    }
    // show/hide input sections
    const sec = document.getElementById(k === 'ollama' ? 'ollamaSection' : k+'KeySection');
    if (sec) sec.style.display = k === b ? 'block' : 'none';
  });
  const btn = document.getElementById('wizSaveBtn');
  if (btn) { btn.disabled = false; btn.textContent = `Start with ${b.charAt(0).toUpperCase()+b.slice(1)} →`; }
}

async function wizTestOllama() {
  const status = document.getElementById('wizOllamaStatus');
  status.textContent = '⏳ Connecting...'; status.style.color = '#888';
  try {
    const r = await fetch(`${window.OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const d = await r.json();
      const models = (d.models||[]).map(m=>m.name);
      status.textContent = models.length ? `✓ Connected! Models: ${models.join(', ')}` : '✓ Connected but no models. Run: ollama pull mistral';
      status.style.color = '#6bcb77';
    } else throw new Error('HTTP '+r.status);
  } catch(e) {
    status.textContent = `✗ Cannot reach Ollama. Make sure it's running: OLLAMA_ORIGINS=* ollama serve`;
    status.style.color = '#ff9090';
  }
}

function wizSave() {
  const b = _wizBackend;
  if (!b) return;
  const errEl = document.getElementById('wizError');
  errEl.style.display = 'none';

  if (b === 'groq') {
    const key = document.getElementById('wizGroqKey').value.trim();
    if (!key) { errEl.textContent = 'Please paste your Groq API key above.'; errEl.style.display='block'; return; }
    const model = document.getElementById('wizGroqKey').dataset.model || 'llama3-70b-8192';
    window.GROQ_KEY = key; window.GROQ_MODEL = model; window.AI_BACKEND = 'groq';
    localStorage.setItem('groq_key', key); localStorage.setItem('groq_model', model);
  } else if (b === 'gemini') {
    const key = document.getElementById('wizGeminiKey').value.trim();
    if (!key) { errEl.textContent = 'Please paste your Gemini API key above.'; errEl.style.display='block'; return; }
    window.GEMINI_KEY = key; window.GEMINI_MODEL = ''; window.AI_BACKEND = 'gemini';
    localStorage.setItem('gemini_key', key); localStorage.setItem('gemini_model', '');
  } else if (b === 'ollama') {
    const model = document.getElementById('wizOllamaModel').value.trim() || 'mistral';
    window.OLLAMA_MODEL = model; window.AI_BACKEND = 'ollama';
    localStorage.setItem('ollama_model', model);
  }
  localStorage.setItem('ai_backend', b);
  document.getElementById('setupWizard').style.display = 'none';
  initAIBar();
  showToast(`✓ ${b.charAt(0).toUpperCase()+b.slice(1)} ready! All tools are now active.`, 'ok');
}

// ── Toast notification ─────────────────────────────────────────────────────
function showToast(msg, type = 'ok') {
  const colors = { ok: '#6bcb77', warn: '#ffd93d', err: '#ff6b6b' };
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);z-index:99999;
    background:#111120;border:1px solid ${colors[type]};border-radius:10px;
    padding:10px 20px;font-size:13px;color:${colors[type]};font-family:'DM Sans',sans-serif;
    box-shadow:0 8px 32px rgba(0,0,0,.5);opacity:0;transition:all .3s;white-space:nowrap
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 3000);
}

// ── XSS-safe HTML escape ───────────────────────────────────────────────────
function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Master callClaude with timeout + retry + abort ─────────────────────────
async function callClaude(systemPrompt, userMsg, opts = {}) {
  const { jsonMode = false, timeout = 90000, retries = 2 } = opts;
  const backend = window.AI_BACKEND;
  if (backend === 'none') {
    showSetupWizard();
    throw new Error('No AI backend configured. Please complete setup.');
  }

  // Create abort controller
  window._currentAbort = new AbortController();
  const signal = window._currentAbort.signal;

  // Timeout wrapper
  const timeoutId = setTimeout(() => window._currentAbort?.abort(), timeout);

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let result;
      if (backend === 'gemini') result = await callGemini(systemPrompt, userMsg, signal, jsonMode);
      else if (backend === 'groq') result = await callGroq(systemPrompt, userMsg, signal, jsonMode);
      else result = await callOllama(systemPrompt, userMsg, signal, jsonMode);
      clearTimeout(timeoutId);
      return result;
    } catch(e) {
      lastErr = e;
      if (signal.aborted) { clearTimeout(timeoutId); throw new Error('Generation cancelled.'); }
      // Retry on rate limit
      if (attempt < retries && (e.message.includes('429') || e.message.includes('rate'))) {
        await new Promise(r => setTimeout(r, (attempt+1) * 2000));
        continue;
      }
      break;
    }
  }
  clearTimeout(timeoutId);
  throw lastErr;
}

// ── Ollama ─────────────────────────────────────────────────────────────────
async function callOllama(systemPrompt, userMsg, signal, jsonMode) {
  const url = window.OLLAMA_URL, model = window.OLLAMA_MODEL;
  const body = { model, stream: false,
    messages: [...(systemPrompt?[{role:'system',content:systemPrompt}]:[]), {role:'user',content:userMsg}],
    options: { temperature: jsonMode ? 0.1 : 0.7 }
  };
  if (jsonMode) body.format = 'json';

  let response;
  try {
    response = await fetch(`${url}/api/chat`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body), signal
    });
  } catch(err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(`Cannot reach Ollama at ${url}.\n\nFix: Open terminal and run:\n  OLLAMA_ORIGINS=* ollama serve\n\nThen pull a model:\n  ollama pull mistral`);
  }
  if (!response.ok) {
    const txt = await response.text().catch(()=>'');
    throw new Error(`Ollama error ${response.status}: ${txt||'unknown'}`);
  }
  const data = await response.json();
  return data.message?.content || data.response || '';
}

// ── Gemini ─────────────────────────────────────────────────────────────────

// ── Auto-detect best Gemini model from API key ──────────────────────────────
async function autoDetectGeminiModel(key) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=50`);
    if (!res.ok) return '';
    const data = await res.json();
    const models = (data.models||[]).map(m=>m.name.replace('models/','')).filter(m=>m.includes('gemini')&&!m.includes('embedding')&&!m.includes('aqa'));
    const pref = ['gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash','gemini-2.0-pro','gemini-1.5-flash','gemini-1.5-pro'];
    for (const p of pref) { const f=models.find(m=>m.startsWith(p)); if(f)return f; }
    return models[0]||'';
  } catch(e) { return ''; }
}
async function detectAndFillModel() {
  const key = document.getElementById('geminiKey')?.value?.trim()||window.GEMINI_KEY;
  if (!key) { showToast('⚠ Enter API key first','warn'); return; }
  const st = document.getElementById('modelDetectStatus');
  if (st) { st.style.display='block'; st.textContent='🔍 Detecting...'; st.style.color='#4d96ff'; }
  const d = await autoDetectGeminiModel(key);
  if (d) { const el=document.getElementById('geminiModel'); if(el)el.value=d; if(st){st.textContent='✓ '+d;st.style.color='#6bcb77';} showToast('✓ Model: '+d,'ok'); }
  else { if(st){st.textContent='⚠ Check your API key';st.style.color='#ff9a3c';} showToast('⚠ Could not detect','warn'); }
}
async function callGemini(systemPrompt, userMsg, signal, jsonMode) {
  if(!window.GEMINI_MODEL){window.GEMINI_MODEL=await autoDetectGeminiModel(window.GEMINI_KEY)||'gemini-2.0-flash';localStorage.setItem('gemini_model',window.GEMINI_MODEL);}
  const key = window.GEMINI_KEY, model = window.GEMINI_MODEL;
  if (!key) { showSetupWizard(); throw new Error('No Gemini API key. Complete setup first.'); }
  const body = {
    contents: [{role:'user', parts:[{text:(systemPrompt?systemPrompt+'\n\n':'')+userMsg}]}],
    generationConfig: { temperature: jsonMode?0.1:0.7, maxOutputTokens: 8192,
      ...(jsonMode ? {responseMimeType:'application/json'} : {}) }
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal}
  );
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    const msg = err?.error?.message || res.status;
    if (res.status === 429) throw new Error('429 Gemini rate limit hit. Retrying...');
    throw new Error(`Gemini error: ${msg}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}

// ── Groq ───────────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userMsg, signal, jsonMode) {
  const key = window.GROQ_KEY, model = window.GROQ_MODEL;
  if (!key) { showSetupWizard(); throw new Error('No Groq API key. Complete setup first.'); }
  const messages = [];
  if (systemPrompt) messages.push({role:'system', content:systemPrompt});
  messages.push({role:'user', content:userMsg});
  const body = { model, messages, temperature: jsonMode?0.1:0.7, max_tokens: 8192,
    ...(jsonMode ? {response_format:{type:'json_object'}} : {}) };
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
    body:JSON.stringify(body), signal
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    if (res.status === 429) throw new Error('429 Groq rate limit hit. Retrying...');
    throw new Error(`Groq error: ${err?.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── Ollama streaming (for chat) ────────────────────────────────────────────
async function callOllamaStream(systemPrompt, userMsg, onChunk, signal) {
  const url = window.OLLAMA_URL, model = window.OLLAMA_MODEL;
  const body = { model, stream: true,
    messages:[...(systemPrompt?[{role:'system',content:systemPrompt}]:[]),{role:'user',content:userMsg}],
    options:{temperature:0.7}
  };
  let response;
  try {
    response = await fetch(`${url}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  } catch(e) {
    if (e.name==='AbortError') throw e;
    throw new Error(`Cannot reach Ollama. Run: OLLAMA_ORIGINS=* ollama serve`);
  }
  if (!response.ok) {
    const txt = await response.text().catch(()=>'');
    throw new Error(`Ollama error ${response.status}: ${txt||'unknown'}`);
  }
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  while(true) {
    const {done, value} = await reader.read();
    if (done) break;
    const lines = dec.decode(value).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        const token = d.message?.content || '';
        if (token) { full += token; onChunk(token, full); }
      } catch {}
    }
  }
  return full;
}

// ── Groq streaming ─────────────────────────────────────────────────────────
async function callGroqStream(systemPrompt, userMsg, onChunk, signal) {
  const key = window.GROQ_KEY, model = window.GROQ_MODEL;
  if (!key) throw new Error('No Groq API key');
  const messages = [];
  if (systemPrompt) messages.push({role:'system',content:systemPrompt});
  messages.push({role:'user',content:userMsg});
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
    body:JSON.stringify({model,messages,temperature:0.7,max_tokens:8192,stream:true}),
    signal
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let full = '';
  while(true) {
    const {done,value} = await reader.read(); if(done) break;
    const lines = dec.decode(value).split('\n').filter(l=>l.startsWith('data:') && !l.includes('[DONE]'));
    for(const line of lines) {
      try {
        const d = JSON.parse(line.slice(5));
        const token = d.choices?.[0]?.delta?.content||'';
        if(token){full+=token;onChunk(token,full);}
      } catch {}
    }
  }
  return full;
}

// ── Gemini streaming ───────────────────────────────────────────────────────
async function callGeminiStream(systemPrompt, userMsg, onChunk, signal) {
  if(!window.GEMINI_MODEL){window.GEMINI_MODEL=await autoDetectGeminiModel(window.GEMINI_KEY)||'gemini-2.0-flash';localStorage.setItem('gemini_model',window.GEMINI_MODEL);}
  const key = window.GEMINI_KEY, model = window.GEMINI_MODEL;
  if (!key) throw new Error('No Gemini API key');
  const body = {
    contents:[{role:'user',parts:[{text:(systemPrompt?systemPrompt+'\n\n':'')+userMsg}]}],
    generationConfig:{temperature:0.7,maxOutputTokens:8192}
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal}
  );
  if(!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let full='';
  while(true){
    const{done,value}=await reader.read(); if(done) break;
    const lines=dec.decode(value).split('\n').filter(l=>l.startsWith('data:'));
    for(const line of lines){
      try{
        const d=JSON.parse(line.slice(5));
        const token=d.candidates?.[0]?.content?.parts?.[0]?.text||'';
        if(token){full+=token;onChunk(token,full);}
      }catch{}
    }
  }
  return full;
}

// ── Universal streaming dispatcher ─────────────────────────────────────────
async function callClaudeStream(systemPrompt, userMsg, onChunk) {
  window._currentAbort = new AbortController();
  const signal = window._currentAbort.signal;
  const b = window.AI_BACKEND;
  if (b === 'groq')   return callGroqStream(systemPrompt, userMsg, onChunk, signal);
  if (b === 'gemini') return callGeminiStream(systemPrompt, userMsg, onChunk, signal);
  return callOllamaStream(systemPrompt, userMsg, onChunk, signal);
}

// ── PDF text extraction ────────────────────────────────────────────────────
async function extractPDFText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({data:typedArray}).promise;
        let fullText = ''; const total = pdf.numPages;
        for (let i=1;i<=total;i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          let pageText=''; let lastY=null;
          for (const item of content.items) {
            if (lastY!==null && Math.abs(item.transform[5]-lastY)>5) pageText+='\n';
            pageText+=item.str;
            if (item.hasEOL) pageText+='\n';
            else if (item.str && !item.str.endsWith(' ')) pageText+=' ';
            lastY=item.transform[5];
          }
          fullText+=`\n[Page ${i}]\n${pageText.trim()}`;
          if (typeof window.onPDFProgress==='function') window.onPDFProgress(i,total);
        }
        resolve(fullText.trim());
      } catch(err){reject(err);}
    };
    reader.onerror=reject; reader.readAsArrayBuffer(file);
  });
}

// ── setLoading — with optional cancel button ───────────────────────────────
function setLoading(btn, isLoading, defaultHTML, cancelable = false) {
  btn.disabled = isLoading;
  if (isLoading) {
    const cancelPart = cancelable
      ? `<button onclick="window._currentAbort&&window._currentAbort.abort()" style="margin-left:8px;background:rgba(255,100,100,.2);border:1px solid #ff6b6b44;border-radius:6px;color:#ff9090;padding:2px 8px;cursor:pointer;font-size:11px;font-family:inherit">✕ Cancel</button>`
      : '';
    btn.innerHTML = `<span class="loading-dots"><span></span><span></span><span></span></span> Working...${cancelPart}`;
  } else {
    btn.innerHTML = defaultHTML;
  }
}

// ── showOutput — XSS safe, raw text stored separately ─────────────────────
window._lastOutputText = {};
function showOutput(el, text, isError = false) {
  const id = el.id || 'output';
  window._lastOutputText[id] = text; // store raw for copy
  el.style.color = isError ? '#ff6b6b' : '';
  if (!text) { el.innerHTML = '<span class="output-placeholder">Output will appear here...</span>'; return; }
  el.innerHTML = escHtml(text)
    .replace(/\n/g,'<br>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/^(#{1,3}) (.+)$/gm,'<strong style="font-size:15px;color:#ddd">$2</strong>')
    .replace(/`([^`]+)`/g,'<code style="background:#1a1a2e;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>');
}

// ── showOutputStreaming — word by word ─────────────────────────────────────
function showOutputStreaming(el, fullText) {
  const id = el.id || 'output';
  window._lastOutputText[id] = fullText;
  el.style.color = '';
  el.innerHTML = escHtml(fullText)
    .replace(/\n/g,'<br>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code style="background:#1a1a2e;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>');
  el.scrollTop = el.scrollHeight;
}

// ── showSkeleton — pulsing loading state in output box ────────────────────
function showSkeleton(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${[100,85,92,70,88].map(w=>`<div style="height:12px;background:linear-gradient(90deg,var(--border) 25%,var(--border2) 50%,var(--border) 75%);background-size:200% 100%;border-radius:6px;width:${w}%;animation:shimmer 1.5s infinite"></div>`).join('')}
    </div>
    <style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>
  `;
}

// ── copyOutput — always copies clean raw text ──────────────────────────────
function copyOutput(elId, btn) {
  const text = window._lastOutputText[elId] || document.getElementById(elId)?.innerText || '';
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(()=>btn.textContent=orig, 2000);
  });
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(()=>btn.textContent=orig, 2000);
  });
}

// ── Download output as .txt ────────────────────────────────────────────────
function downloadOutput(elId, filename = 'output.txt') {
  const text = window._lastOutputText[elId] || document.getElementById(elId)?.innerText || '';
  if (!text || text.includes('will appear here')) { showToast('Nothing to download yet', 'warn'); return; }
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✓ Downloaded!', 'ok');
}

// ── Word/token counter + warning ───────────────────────────────────────────
function checkWordLimit(text, warnEl) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!warnEl) return words;
  if (words > 3000) {
    warnEl.innerHTML = `⚠ ${words.toLocaleString()} words — may be slow with local models. Consider using Gemini for large texts.`;
    warnEl.style.display = 'block';
  } else if (words > 1000) {
    warnEl.innerHTML = `ℹ ${words.toLocaleString()} words`;
    warnEl.style.display = 'block';
    warnEl.style.color = 'var(--muted)';
  } else {
    warnEl.style.display = 'none';
  }
  return words;
}

// ── Speed timer ────────────────────────────────────────────────────────────
let _timerStart = 0;
function startTimer() { _timerStart = Date.now(); }
function getElapsed() {
  const ms = Date.now() - _timerStart;
  return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`;
}

// ── Safe JSON parse with bracket extraction ────────────────────────────────
function safeParseJSON(raw) {
  let s = raw.replace(/```json|```/g,'').trim();
  // Try array first
  const ab = s.indexOf('['), ae = s.lastIndexOf(']');
  if (ab !== -1 && ae !== -1) {
    try { return JSON.parse(s.substring(ab, ae+1)); } catch {}
  }
  // Try object
  const ob = s.indexOf('{'), oe = s.lastIndexOf('}');
  if (ob !== -1 && oe !== -1) {
    try { return JSON.parse(s.substring(ob, oe+1)); } catch {}
  }
  throw new Error('Could not parse AI response as JSON. Try running again.');
}

// ── fetchOllamaModels ──────────────────────────────────────────────────────
async function fetchOllamaModels() {
  try {
    const r = await fetch(`${window.OLLAMA_URL}/api/tags`,{signal:AbortSignal.timeout(3000)});
    if(!r.ok) return [];
    const d = await r.json();
    return (d.models||[]).map(m=>m.name);
  } catch {return [];}
}

// ── AI Status Bar (bottom-right) ───────────────────────────────────────────
function initAIBar() {
  if (document.getElementById('aiBar')) return;
  const bar = document.createElement('div');
  bar.id = 'aiBar';
  bar.style.cssText = `
    position:fixed;bottom:20px;right:20px;z-index:9999;
    background:#111120;border:1px solid #252538;border-radius:12px;
    padding:10px 14px;display:flex;align-items:center;gap:10px;
    font-size:12px;box-shadow:0 8px 32px rgba(0,0,0,.6);font-family:'DM Sans',sans-serif;
  `;
  bar.innerHTML = `
    <span id="aiDot" style="width:8px;height:8px;border-radius:50%;background:#555;display:inline-block;flex-shrink:0"></span>
    <span id="aiStatus" style="color:#888;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis">Checking...</span>
    <button onclick="showAIModal()" style="background:#1a1a2e;border:1px solid #333;border-radius:6px;color:#aaa;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit;white-space:nowrap">⚙ Config</button>
    <button onclick="showClearDataModal()" style="background:#1a1a2e;border:1px solid #333;border-radius:6px;color:#ff9090;padding:4px 10px;cursor:pointer;font-size:11px;font-family:inherit;white-space:nowrap" title="Clear all stored data">🗑</button>
    <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;color:#444;cursor:pointer;font-size:16px;padding:0 2px;line-height:1">×</button>
  `;
  document.body.appendChild(bar);

  // Config Modal
  const modal = document.createElement('div');
  modal.id = 'aiModal';
  modal.style.cssText = `display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);align-items:center;justify-content:center`;
  modal.innerHTML = `
    <div style="background:#0d0d1a;border:1px solid #252538;border-radius:16px;padding:28px;max-width:500px;width:92%;font-family:'DM Sans',sans-serif;max-height:90vh;overflow-y:auto">
      <h2 style="font-size:17px;font-weight:700;margin-bottom:16px;color:#e8e8f0">⚙ AI Backend Config</h2>
      <div class="label">Active Backend</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px">
        <button id="be-ollama" onclick="selectBackend('ollama')" style="padding:10px;border-radius:10px;border:1px solid #252538;background:#111120;color:#666;cursor:pointer;font-family:inherit;font-weight:600;font-size:13px">Ollama</button>
        <button id="be-gemini" onclick="selectBackend('gemini')" style="padding:10px;border-radius:10px;border:1px solid #252538;background:#111120;color:#666;cursor:pointer;font-family:inherit;font-weight:600;font-size:13px">Gemini</button>
        <button id="be-groq"   onclick="selectBackend('groq')"   style="padding:10px;border-radius:10px;border:1px solid #252538;background:#111120;color:#666;cursor:pointer;font-family:inherit;font-weight:600;font-size:13px">Groq</button>
      </div>
      <div id="sec-ollama" style="display:none">
        <div class="label">Ollama URL</div>
        <input type="text" id="ollamaUrl" placeholder="http://localhost:11434" style="margin-bottom:10px">
        <div class="label">Model</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="text" id="ollamaModel" placeholder="mistral" style="flex:1">
          <button onclick="loadOllamaModels()" style="background:#1a1a2e;border:1px solid #333;border-radius:8px;color:#aaa;padding:10px 14px;cursor:pointer;font-size:12px;white-space:nowrap;font-family:inherit">📋 List</button>
        </div>
        <div id="ollamaModelList" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;min-height:20px"></div>
      </div>
      <div id="sec-gemini" style="display:none">
        <p style="font-size:12px;color:#555570;margin-bottom:12px">Free key at <a href="https://aistudio.google.com" target="_blank" style="color:#4d96ff">aistudio.google.com</a></p>
        <div class="label">API Key</div>
        <input type="password" id="geminiKey" placeholder="AIza..." style="margin-bottom:10px">
        <div class="label">Model</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${['gemini-2.0-flash','gemini-2.5-flash','gemini-1.5-pro'].map(m=>`<button onclick="document.getElementById('geminiModel').value='${m}'" style="background:#1a1a2e;border:1px solid #252538;border-radius:6px;color:#4d96ff;padding:4px 10px;cursor:pointer;font-size:11px;font-family:monospace">${m}</button>`).join('')}
        </div>
        <input type="text" id="geminiModel" placeholder="auto-detect on save" style="margin-bottom:10px">
      </div>
      <div id="sec-groq" style="display:none">
        <p style="font-size:12px;color:#555570;margin-bottom:12px">Free key at <a href="https://console.groq.com" target="_blank" style="color:#c77dff">console.groq.com</a></p>
        <div class="label">API Key</div>
        <input type="password" id="groqKey" placeholder="gsk_..." style="margin-bottom:10px">
        <div class="label">Model</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          ${['llama3-70b-8192','llama3-8b-8192','mixtral-8x7b-32768','gemma2-9b-it'].map(m=>`<button onclick="document.getElementById('groqModel').value='${m}'" style="background:#1a1a2e;border:1px solid #252538;border-radius:6px;color:#c77dff;padding:4px 10px;cursor:pointer;font-size:11px;font-family:monospace">${m}</button>`).join('')}
        </div>
        <input type="text" id="groqModel" placeholder="llama3-70b-8192" style="margin-bottom:10px">
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button onclick="saveAIConfig()" style="flex:1;background:#4d96ff;color:#000;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:14px;font-family:inherit">Save & Close</button>
        <button onclick="testAI()" style="background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:10px;padding:11px 14px;cursor:pointer;font-size:13px;font-family:inherit">Test</button>
        <button onclick="document.getElementById('aiModal').style.display='none'" style="background:#1a1a2e;color:#888;border:1px solid #252538;border-radius:10px;padding:11px 14px;cursor:pointer;font-size:13px;font-family:inherit">✕</button>
      </div>
      <div id="aiTestResult" style="margin-top:10px;font-size:12px;color:#888;white-space:pre-wrap;line-height:1.5"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // Initialize backend buttons
  selectBackend(window.AI_BACKEND, true);
  checkAIStatus();
  setInterval(checkAIStatus, 30000);
}

function selectBackend(b, init=false) {
  if (!init) window.AI_BACKEND = b;
  const colors = {ollama:'#6bcb77',gemini:'#4d96ff',groq:'#c77dff'};
  const vals = {
    ollama:{url:window.OLLAMA_URL,model:window.OLLAMA_MODEL},
    gemini:{key:window.GEMINI_KEY,model:window.GEMINI_MODEL},
    groq:{key:window.GROQ_KEY,model:window.GROQ_MODEL}
  };
  ['ollama','gemini','groq'].forEach(k=>{
    const btn=document.getElementById(`be-${k}`);
    const sec=document.getElementById(`sec-${k}`);
    const active=k===b;
    if(btn){btn.style.borderColor=active?colors[k]:'#252538';btn.style.background=active?colors[k]+'22':'#111120';btn.style.color=active?colors[k]:'#666';}
    if(sec){sec.style.display=active?'block':'none';}
  });
  // Populate fields
  if(b==='ollama'){
    const u=document.getElementById('ollamaUrl');const m=document.getElementById('ollamaModel');
    if(u)u.value=vals.ollama.url;if(m)m.value=vals.ollama.model;
  }else if(b==='gemini'){
    const k=document.getElementById('geminiKey');const m=document.getElementById('geminiModel');
    if(k)k.value=vals.gemini.key;if(m)m.value=vals.gemini.model;
  }else if(b==='groq'){
    const k=document.getElementById('groqKey');const m=document.getElementById('groqModel');
    if(k)k.value=vals.groq.key;if(m)m.value=vals.groq.model;
  }
}

async function loadOllamaModels() {
  const el=document.getElementById('ollamaModelList');
  if(!el)return;
  el.innerHTML='<span style="color:#555;font-size:12px">Loading...</span>';
  const url=document.getElementById('ollamaUrl')?.value||window.OLLAMA_URL;
  try{
    const r=await fetch(`${url}/api/tags`,{signal:AbortSignal.timeout(3000)});
    const d=await r.json();
    const models=(d.models||[]).map(m=>m.name);
    if(!models.length){el.innerHTML='<span style="color:#ff9090;font-size:12px">No models. Run: ollama pull mistral</span>';return;}
    el.innerHTML=models.map(m=>`<button onclick="document.getElementById('ollamaModel').value='${m}'" style="background:#1a1a2e;border:1px solid #252538;border-radius:6px;color:#c77dff;padding:4px 10px;cursor:pointer;font-size:11px;font-family:monospace">${m}</button>`).join('');
  }catch{el.innerHTML='<span style="color:#ff9090;font-size:12px">Cannot reach Ollama</span>';}
}

function showAIModal() {
  const m=document.getElementById('aiModal');
  if(m){m.style.display='flex';selectBackend(window.AI_BACKEND,true);if(window.AI_BACKEND==='ollama')loadOllamaModels();}
}

async function testAI() {
  const res=document.getElementById('aiTestResult');
  res.textContent='⏳ Testing...';res.style.color='#888';
  startTimer();
  try{
    const reply=await callClaude('','Reply with exactly: READY');
    res.textContent=`✓ Working! (${getElapsed()}) Response: "${reply.trim().slice(0,60)}"`;
    res.style.color='#6bcb77';
  }catch(e){res.textContent=`✗ ${e.message}`;res.style.color='#ff6b6b';}
}

function saveAIConfig() {
  const b=window.AI_BACKEND;
  if(b==='ollama'){
    window.OLLAMA_URL=document.getElementById('ollamaUrl').value.trim()||'http://localhost:11434';
    window.OLLAMA_MODEL=document.getElementById('ollamaModel').value.trim()||'mistral';
    localStorage.setItem('ollama_url',window.OLLAMA_URL);
    localStorage.setItem('ollama_model',window.OLLAMA_MODEL);
  }else if(b==='gemini'){
    window.GEMINI_KEY=document.getElementById('geminiKey').value.trim();
    window.GEMINI_MODEL=document.getElementById('geminiModel').value.trim();
    localStorage.setItem('gemini_key',window.GEMINI_KEY);
    localStorage.setItem('gemini_model',window.GEMINI_MODEL);
  }else if(b==='groq'){
    window.GROQ_KEY=document.getElementById('groqKey').value.trim();
    window.GROQ_MODEL=document.getElementById('groqModel').value.trim()||'llama3-70b-8192';
    localStorage.setItem('groq_key',window.GROQ_KEY);
    localStorage.setItem('groq_model',window.GROQ_MODEL);
  }
  localStorage.setItem('ai_backend',b);
  document.getElementById('aiModal').style.display='none';
  checkAIStatus();
  showToast('✓ Config saved!','ok');
}

async function checkAIStatus() {
  const dot=document.getElementById('aiDot');
  const status=document.getElementById('aiStatus');
  if(!dot||!status)return;
  const b=window.AI_BACKEND;
  const colors={ollama:'#6bcb77',gemini:'#4d96ff',groq:'#c77dff'};
  const labels={ollama:'Ollama',gemini:'Gemini',groq:'Groq'};
  if(b==='ollama'){
    try{
      const r=await fetch(`${window.OLLAMA_URL}/api/tags`,{signal:AbortSignal.timeout(3000)});
      if(r.ok){
        const d=await r.json();const count=(d.models||[]).length;
        dot.style.cssText=`width:8px;height:8px;border-radius:50%;background:#6bcb77;box-shadow:0 0 6px #6bcb77;display:inline-block;flex-shrink:0`;
        status.style.color='#6bcb77';status.textContent=`Ollama · ${window.OLLAMA_MODEL} (${count})`;
      }else throw 0;
    }catch{
      dot.style.cssText=`width:8px;height:8px;border-radius:50%;background:#ff6b6b;box-shadow:0 0 6px #ff6b6b;display:inline-block;flex-shrink:0`;
      status.style.color='#ff9090';status.textContent='Ollama offline';
    }
  }else if(b==='none'){
    dot.style.cssText=`width:8px;height:8px;border-radius:50%;background:#ffd93d;display:inline-block;flex-shrink:0`;
    status.style.color='#ffd93d';status.textContent='No backend set';
  }else{
    const hasKey=b==='gemini'?!!window.GEMINI_KEY:!!window.GROQ_KEY;
    const model=b==='gemini'?window.GEMINI_MODEL:window.GROQ_MODEL;
    const c=colors[b];
    dot.style.cssText=`width:8px;height:8px;border-radius:50%;background:${hasKey?c:'#ff6b6b'};box-shadow:0 0 6px ${hasKey?c:'#ff6b6b'};display:inline-block;flex-shrink:0`;
    status.style.color=hasKey?c:'#ff9090';
    status.textContent=hasKey?`${labels[b]} · ${model}`:`${labels[b]} — no key`;
  }
}

// ── Clear Data Modal ───────────────────────────────────────────────────────
function showClearDataModal() {
  const existing = document.getElementById('clearDataModal');
  if (existing) { existing.style.display = 'flex'; return; }

  const modal = document.createElement('div');
  modal.id = 'clearDataModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:30000;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:#0d0d1a;border:1px solid #252538;border-radius:16px;padding:28px;max-width:420px;width:100%;font-family:'DM Sans',sans-serif;text-align:center">
      <div style="font-size:36px;margin-bottom:12px">🗑</div>
      <h2 style="font-size:17px;font-weight:700;margin-bottom:8px;color:#e8e8f0">Clear All Data?</h2>
      <p style="color:#555570;font-size:13px;line-height:1.6;margin-bottom:20px">This will remove all stored API keys, chat history, tool history, and settings. This action cannot be undone.</p>
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('clearDataModal').style.display='none'" style="flex:1;background:#1a1a2e;border:1px solid #333;border-radius:10px;color:#aaa;padding:11px;cursor:pointer;font-size:14px;font-family:inherit">Cancel</button>
        <button onclick="clearAllData()" style="flex:1;background:#ff6b6b;color:#000;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:14px;font-family:inherit">Clear Everything</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

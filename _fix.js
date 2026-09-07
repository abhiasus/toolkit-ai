const fs = require('fs');

function fixScript(code) {
  let out = '';
  let mode = 'code';
  let lastSig = '';
  let inClass = false;
  let fixed = 0;
  const regexAllowed = () => lastSig === '' || '(,=:[!&|?{};+-*%~^<>\n'.includes(lastSig);

  for (let i = 0; i < code.length; i++) {
    const c = code[i], n = code[i + 1];

    if (mode === 'code') {
      if (c === "'") { mode = 'sq'; out += c; }
      else if (c === '"') { mode = 'dq'; out += c; }
      else if (c === '`') { mode = 'tpl'; out += c; }
      else if (c === '/' && n === '/') { mode = 'linec'; out += c; }
      else if (c === '/' && n === '*') { mode = 'blockc'; out += c; }
      else if (c === '/' && regexAllowed()) { mode = 're'; inClass = false; out += c; }
      else { out += c; if (!/\s/.test(c)) lastSig = c; }
    }
    else if (mode === 'sq' || mode === 'dq') {
      const q = mode === 'sq' ? "'" : '"';
      if (c === '\\') { out += c + (n ?? ''); i++; }
      else if (c === q) { mode = 'code'; lastSig = q; out += c; }
      else if (c === '\n') { out += '\\n'; fixed++; }
      else out += c;
    }
    else if (mode === 'tpl') {
      if (c === '\\') { out += c + (n ?? ''); i++; }
      else if (c === '`') { mode = 'code'; lastSig = '`'; out += c; }
      else out += c;
    }
    else if (mode === 'linec') {
      if (c === '\n') { mode = 'code'; out += c; } else out += c;
    }
    else if (mode === 'blockc') {
      if (c === '*' && n === '/') { out += '*/'; i++; mode = 'code'; } else out += c;
    }
    else if (mode === 're') {
      if (c === '\\') { out += c + (n ?? ''); i++; }
      else if (c === '\n') { out += '\\n'; fixed++; }
      else if (c === '[') { inClass = true; out += c; }
      else if (c === ']') { inClass = false; out += c; }
      else if (c === '/' && !inClass) { mode = 'code'; lastSig = '/'; out += c; }
      else out += c;
    }
  }
  return { out, fixed };
}

const files = ['convert.html','data-analyzer.html','meeting-notes.html','recipe.html','social.html','study-planner.html','travel.html','workout.html'];
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  let total = 0;
  const fixedHtml = html.replace(/(<script(?![^>]*\bsrc\b)[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, body, close) => {
    const r = fixScript(body);
    total += r.fixed;
    return open + r.out + close;
  });
  fs.writeFileSync(f, fixedHtml);
  console.log(f + ': converted ' + total + ' raw newline(s) to \\n');
}

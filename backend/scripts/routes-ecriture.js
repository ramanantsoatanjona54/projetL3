const fs = require('fs');
const path = require('path');

function* fichiers(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* fichiers(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

// Découpe un service en { nomDeMéthode: corps }
function methodes(txt) {
  const m = new Map();
  let nom = null, buf = [];
  const fin = () => { if (nom) m.set(nom, (m.get(nom) || '') + buf.join('\n')); };
  for (const l of txt.split(/\r?\n/)) {
    const d = /^  (?:(?:private|public|protected|async|static)\s+)*([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\(/.exec(l);
    if (d && !/^  (if|for|while|switch|return)\b/.test(l)) { fin(); nom = d[1]; buf = []; }
    buf.push(l);
  }
  fin();
  return m;
}

const AUDIT = /journalAudit|journaliser|audit/i;
const services = new Map(); // dossier -> Map(méthode -> corps)
for (const f of fichiers('src')) {
  if (!f.endsWith('.service.ts')) continue;
  const d = path.dirname(f);
  const cumul = services.get(d) ?? new Map();
  for (const [k, v] of methodes(fs.readFileSync(f, 'utf8'))) cumul.set(k, (cumul.get(k) || '') + v);
  services.set(d, cumul);
}

const sorties = [];
for (const f of fichiers('src')) {
  if (!f.endsWith('.controller.ts')) continue;
  const L = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  L.forEach((l, i) => {
    const r = /@(Post|Patch|Put|Delete)\(([^)]*)\)/.exec(l);
    if (!r) return;
    let handler = null;
    for (let j = i + 1; j < Math.min(i + 10, L.length); j++) {
      const t = L[j].trim();
      if (!t || t.startsWith('@')) continue;
      const h = /^(?:async\s+)?([A-Za-z0-9_]+)\s*\(/.exec(t);
      if (h) { handler = h[1]; handlerLigne = j; break; }
    }
    if (!handler) return;
    let appel = null;
    for (let j = i; j < Math.min(i + 20, L.length); j++) {
      const a = /this\.\w+\.([A-Za-z0-9_]+)\(/.exec(L[j]);
      if (a) { appel = a[1]; break; }
    }
    const corps = services.get(path.dirname(f))?.get(appel) ?? '';
    if (!appel || !AUDIT.test(corps)) {
      sorties.push(`${f.replace(/^src[\\/]/, '')}:${i + 1}  ${r[1].toUpperCase()} ${r[2] || '/'}  -> ${handler}() -> ${appel ?? '?'}()`);
    }
  });
}
console.log(`${sorties.length} route(s) d'écriture sans audit apparent :\n`);
console.log(sorties.join('\n'));
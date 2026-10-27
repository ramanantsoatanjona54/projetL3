const fs = require('fs');
const path = require('path');

function* fichiers(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) yield* fichiers(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

const APPEL_AUDIT = /journalAudit\s*\.\s*create(Many)?|this\.audit\w*\.\w+\(/g;
const RISQUE = /(motDePasse|password|hash|secret|token|jeton|totp|authorization|cookie)/i;

const modules = new Map();
const actions = new Map();
const risques = [];

for (const f of fichiers('src')) {
  const d = path.dirname(f);
  const txt = fs.readFileSync(f, 'utf8');
  const m = modules.get(d) ?? { routes_ecriture: 0, appels_audit: 0 };

  if (f.endsWith('.controller.ts')) m.routes_ecriture += (txt.match(/@(Post|Patch|Put|Delete)\(/g) || []).length;
  else if (!f.endsWith('.dto.ts')) m.appels_audit += (txt.match(APPEL_AUDIT) || []).length;
  modules.set(d, m);

  for (const a of txt.matchAll(/action:\s*['"`]([^'"`]+)['"`]/g)) {
    const liste = actions.get(path.basename(d)) ?? new Set();
    liste.add(a[1]);
    actions.set(path.basename(d), liste);
  }

  const lignes = txt.split(/\r?\n/);
  lignes.forEach((l, i) => {
    APPEL_AUDIT.lastIndex = 0;
    if (APPEL_AUDIT.test(l) && RISQUE.test(lignes.slice(i, i + 12).join(' '))) risques.push(`${f}:${i + 1}`);
  });
}

console.log('\n=== 1. Routes d\'écriture et appels d\'audit par module ===');
const tableau = {};
for (const [d, m] of modules) {
  if (m.routes_ecriture || m.appels_audit)
    tableau[d.replace(/^src[\\/]/, '')] = { ...m, alerte: m.routes_ecriture > 0 && m.appels_audit === 0 ? 'AUCUN AUDIT' : '' };
}
console.table(tableau);

console.log('\n=== 2. Actions déjà journalisées ===');
for (const [mod, set] of actions) console.log(mod.padEnd(22), [...set].join(', '));

console.log('\n=== 3. Appels d\'audit près d\'un mot sensible (à examiner à la main) ===');
console.log(risques.length ? risques.join('\n') : 'aucun');
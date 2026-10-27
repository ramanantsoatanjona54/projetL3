const fs = require('fs');
const path = require('path');

function* fichiers(dossier) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) yield* fichiers(p);
    else if (p.endsWith('.dto.ts')) yield p;
  }
}

const PROPRIETE = /(\w+)\??:\s*[^;()]+;\s*$/;
for (const f of fichiers('src')) {
  let bloc = [];
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
    const t = l.trim();
    const m = PROPRIETE.exec(t);
    if (m && !/^(\/\/|import|export)/.test(t)) {
      const b = bloc.join(' ') + ' ' + t;
      if (/@IsString\(/.test(b) && !/@(MaxLength|Matches|IsIn|IsEnum|IsEmail|IsDateString|IsUUID|Length)\(/.test(b)) console.log(`${f}:${i + 1}  ${m[1]} : texte sans longueur maximale`);
      if (/@IsArray\(/.test(b) && !/@ArrayMaxSize\(/.test(b)) console.log(`${f}:${i + 1}  ${m[1]} : tableau sans taille maximale`);
      if (/@(IsInt|IsNumber)\(/.test(b) && !/@(Min|Max|IsPositive)\(/.test(b)) console.log(`${f}:${i + 1}  ${m[1]} : nombre sans bornes`);
      bloc = [];
    } else if (t.startsWith('@')) bloc.push(t);
    else if (t !== '' && !t.startsWith('//')) bloc = [];
  });
}
/**
 * Contenu de depart des bulletins (Classe 2, 1ere annee) tire du modele Excel de l'ecole.
 * Usage (depuis le dossier backend) :  npx ts-node prisma/seed-bulletin.ts
 * Sans danger si on le relance : un semestre qui contient deja des elements n'est jamais touche.
 */
import { PrismaClient, TypeElementBulletin } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const NIVEAU = '11e'; // "Classe 2 - 1ere annee" ; changer ici si votre niveau porte un autre nom
const CREE_LE = new Date('2000-01-01T00:00:00.000Z'); // present dans tous les bulletins, y compris des annees passees

type Rubrique = { titre: string | null; lignes: string[] };
type Discipline = { titre: string; rubriques: Rubrique[] };

const prisma = new PrismaClient();

async function main() {
  const donnees: Record<string, Discipline[]> = JSON.parse(
    readFileSync(join(__dirname, 'data', 'bulletin-11e.json'), 'utf-8'),
  );

  const niveau = await prisma.niveau.findFirst({ where: { nom: NIVEAU }, select: { id: true } });
  if (!niveau) throw new Error(`Niveau « ${NIVEAU} » introuvable : corrigez la constante NIVEAU en haut du fichier.`);

  for (const [numeroTexte, disciplines] of Object.entries(donnees)) {
    const numero = Number(numeroTexte);
    const semestre = await prisma.semestre.findUnique({
      where: { niveauId_numero: { niveauId: niveau.id, numero } }, select: { id: true },
    });
    if (!semestre) { console.log(`Semestre ${numero} : absent pour ${NIVEAU}, ignore.`); continue; }
    if ((await prisma.elementBulletin.count({ where: { semestreId: semestre.id } })) > 0) {
      console.log(`Semestre ${numero} : contient deja des elements, ignore.`);
      continue;
    }

    let total = 0;
    await prisma.$transaction(async (tx) => {
      const creer = (parentId: number | null, type: TypeElementBulletin, libelle: string, ordre: number) => {
        total++;
        return tx.elementBulletin.create({
          data: { semestreId: semestre.id, parentId, type, libelle, ordre, creeLe: CREE_LE }, select: { id: true },
        });
      };
      let ordreD = 0;
      for (const d of disciplines) {
        const disc = await creer(null, 'DISCIPLINE', d.titre, ++ordreD);
        let ordreR = 0;
        for (const r of d.rubriques) {
          // Rubrique absente (ex. Malgache) : les lignes se rattachent directement a la discipline
          const parent = r.titre ? (await creer(disc.id, 'RUBRIQUE', r.titre, ++ordreR)).id : disc.id;
          let ordreL = r.titre ? 0 : ordreR;
          for (const ligne of r.lignes) await creer(parent, 'LIGNE', ligne, ++ordreL);
          if (!r.titre) ordreR = ordreL;
        }
      }
    });
    console.log(`Semestre ${numero} : ${total} elements crees.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
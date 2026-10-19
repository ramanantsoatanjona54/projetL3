/**
 * backend/prisma/seed-programme.ts
 *
 * Insere tout le referentiel pedagogique (Classe 1 / 2 / 3) a partir de
 * programme_data.json (genere depuis programme_fusionne_nettoye.md).
 *
 * Classe 1  -> Domaine / SousDomaine / Competence
 * Classe 2/3 -> Matiere / Rubrique (optionnelle) / Lecon
 *
 * Idempotent : peut etre relance sans creer de doublons (recherche avant
 * creation a chaque niveau de la hierarchie).
 *
 * Usage :
 *   1. Copier programme_data.json a la racine de backend/prisma/
 *   2. npx ts-node prisma/seed-programme.ts
 *      (ou "npx prisma db seed" si tu l'ajoutes a ton script de seed principal)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ---------------------------------------------------------------
// Donnees sources
// ---------------------------------------------------------------
interface RowClasse1 {
  classe: string;
  annee: string;
  semestre: number;
  ceinture: string | null;
  domaine: string | null;
  sousDomaine: string | null;
  competence: string;
}
interface RowClasse23 {
  classe: string;
  annee: string;
  semestre: number;
  ceinture: string | null;
  matiere: string | null;
  rubrique: string | null;
  lecon: string;
}
interface ProgrammeData {
  classe1: RowClasse1[];
  classe23: RowClasse23[];
}

const dataPath = path.join(__dirname, 'programme_data.json');
const data: ProgrammeData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// ---------------------------------------------------------------
// Mapping "Classe X" + "1ère/2ème/3ème année" -> code Niveau reel de l'ecole
// ---------------------------------------------------------------
const NIVEAU_PAR_ANNEE: Record<string, Record<string, string>> = {
  'Classe 1': { '1ère année': 'PS', '2ème année': 'MS', '3ème année': 'GS' },
  'Classe 2': { '1ère année': '11e', '2ème année': '10e' },
  'Classe 3': { '1ère année': '9e', '2ème année': '8e', '3ème année': '7e' },
};

const CLASSE_META: Record<
  string,
  { ordre: number; cycle: string}
> = {
  'Classe 1': { ordre: 1, cycle: 'prescolaire' },
  'Classe 2': { ordre: 2, cycle: 'primaire_1' },
  'Classe 3': { ordre: 3, cycle: 'primaire_2' },
};

// ---------------------------------------------------------------
// Caches (evite de refaire une requete SQL pour chaque ligne)
// ---------------------------------------------------------------
const classeCache = new Map<string, number>();
const niveauCache = new Map<string, number>();
const semestreCache = new Map<string, number>();
const ceintureCache = new Map<string, number>();
const matiereCache = new Map<string, number>();
const rubriqueCache = new Map<string, number>();
const domaineCache = new Map<string, number>();
const sousDomaineCache = new Map<string, number>();

async function getClasse(nomClasse: string): Promise<number> {
  if (classeCache.has(nomClasse)) return classeCache.get(nomClasse)!;
  const meta = CLASSE_META[nomClasse];
  const classe = await prisma.classe.upsert({
    where: { nom: nomClasse },
    update: {},
    create: {
      nom: nomClasse,
      ordre: meta.ordre,
      cycle: meta.cycle,
    },
  });
  classeCache.set(nomClasse, classe.id);
  return classe.id;
}

async function getNiveau(nomClasse: string, annee: string): Promise<number> {
  const nomNiveau = NIVEAU_PAR_ANNEE[nomClasse]?.[annee];
  if (!nomNiveau) {
    throw new Error(`Niveau inconnu pour ${nomClasse} / ${annee}`);
  }
  const key = `${nomClasse}|${nomNiveau}`;
  if (niveauCache.has(key)) return niveauCache.get(key)!;
  const classeId = await getClasse(nomClasse);
  const ordre = Object.values(NIVEAU_PAR_ANNEE[nomClasse]).indexOf(nomNiveau) + 1;
  const niveau = await prisma.niveau.upsert({
    where: { classeId_nom: { classeId, nom: nomNiveau } },
    update: {},
    create: { classeId, nom: nomNiveau, ordre },
  });
  niveauCache.set(key, niveau.id);
  return niveau.id;
}

async function getSemestre(niveauId: number, numero: number): Promise<number> {
  const key = `${niveauId}|${numero}`;
  if (semestreCache.has(key)) return semestreCache.get(key)!;
  const semestre = await prisma.semestre.upsert({
    where: { niveauId_numero: { niveauId, numero } },
    update: {},
    create: { niveauId, numero },
  });
  semestreCache.set(key, semestre.id);
  return semestre.id;
}

async function getCeinture(semestreId: number, nom: string | null, ordre: number): Promise<number> {
  const nomFinal = nom ?? 'unique';
  const key = `${semestreId}|${nomFinal}`;
  if (ceintureCache.has(key)) return ceintureCache.get(key)!;
  const ceinture = await prisma.ceinture.upsert({
    where: { semestreId_nom: { semestreId, nom: nomFinal } },
    update: {},
    create: { semestreId, nom: nomFinal, ordre },
  });
  ceintureCache.set(key, ceinture.id);
  return ceinture.id;
}

async function getMatiere(nom: string): Promise<number> {
  if (matiereCache.has(nom)) return matiereCache.get(nom)!;
  const matiere = await prisma.matiere.upsert({
    where: { nom },
    update: {},
    create: { nom },
  });
  matiereCache.set(nom, matiere.id);
  return matiere.id;
}

async function getRubrique(matiereId: number, nom: string | null): Promise<number | null> {
  if (!nom) return null;
  const key = `${matiereId}|${nom}`;
  if (rubriqueCache.has(key)) return rubriqueCache.get(key)!;
  const rubrique = await prisma.rubrique.upsert({
    where: { matiereId_nom: { matiereId, nom } },
    update: {},
    create: { matiereId, nom },
  });
  rubriqueCache.set(key, rubrique.id);
  return rubrique.id;
}

async function getDomaine(ceintureId: number, nom: string): Promise<number> {
  const key = `${ceintureId}|${nom}`;
  if (domaineCache.has(key)) return domaineCache.get(key)!;
  let domaine = await prisma.domaine.findFirst({ where: { ceintureId, nom } });
  if (!domaine) {
    domaine = await prisma.domaine.create({ data: { ceintureId, nom } });
  }
  domaineCache.set(key, domaine.id);
  return domaine.id;
}

async function getSousDomaine(domaineId: number, nom: string): Promise<number> {
  const key = `${domaineId}|${nom}`;
  if (sousDomaineCache.has(key)) return sousDomaineCache.get(key)!;
  let sousDomaine = await prisma.sousDomaine.findFirst({ where: { domaineId, nom } });
  if (!sousDomaine) {
    sousDomaine = await prisma.sousDomaine.create({ data: { domaineId, nom } });
  }
  sousDomaineCache.set(key, sousDomaine.id);
  return sousDomaine.id;
}

async function createCompetenceIfMissing(
  domaineId: number,
  sousDomaineId: number | null,
  libelle: string,
) {
  const existing = await prisma.competence.findFirst({
    where: { domaineId: sousDomaineId ? null : domaineId, sousDomaineId, libelle },
  });
  if (existing) return;
  await prisma.competence.create({
    data: {
      libelle,
      domaineId: sousDomaineId ? null : domaineId,
      sousDomaineId,
    },
  });
}

async function createLeconIfMissing(args: {
  matiereId: number;
  rubriqueId: number | null;
  niveauId: number;
  ceintureId: number;
  titre: string;
  ordre: number;
}) {
  const { matiereId, rubriqueId, niveauId, ceintureId, titre, ordre } = args;
  const existing = await prisma.lecon.findFirst({
    where: { matiereId, rubriqueId, niveauId, ceintureId, titre },
  });
  if (existing) return;
  await prisma.lecon.create({
    data: { matiereId, rubriqueId, niveauId, ceintureId, titre, ordre },
  });
}

// ---------------------------------------------------------------
// Insertion Classe 1
// ---------------------------------------------------------------
async function seedClasse1() {
  let count = 0;
  let ordreCeinture = 0;
  for (const row of data.classe1) {
    if (!row.domaine) continue; // ligne orpheline, ignoree
    const niveauId = await getNiveau(row.classe, row.annee);
    const semestreId = await getSemestre(niveauId, row.semestre);
    const ceintureId = await getCeinture(semestreId, row.ceinture, ordreCeinture++);
    const domaineId = await getDomaine(ceintureId, row.domaine);
    const sousDomaineId = row.sousDomaine
      ? await getSousDomaine(domaineId, row.sousDomaine)
      : null;
    await createCompetenceIfMissing(domaineId, sousDomaineId, row.competence);
    count++;
  }
  console.log(`Classe 1 : ${count} competences inserees/verifiees.`);
}

// ---------------------------------------------------------------
// Insertion Classe 2 / 3
// ---------------------------------------------------------------
async function seedClasse23() {
  let count = 0;
  let ordreLecon: Record<string, number> = {};
  for (const row of data.classe23) {
    if (!row.matiere) continue;
    const niveauId = await getNiveau(row.classe, row.annee);
    const semestreId = await getSemestre(niveauId, row.semestre);
    const ceintureId = await getCeinture(semestreId, row.ceinture, 0);
    const matiereId = await getMatiere(row.matiere);
    const rubriqueId = await getRubrique(matiereId, row.rubrique);

    const ordreKey = `${ceintureId}|${matiereId}|${rubriqueId ?? 'none'}`;
    ordreLecon[ordreKey] = (ordreLecon[ordreKey] ?? 0) + 1;

    await createLeconIfMissing({
      matiereId,
      rubriqueId,
      niveauId,
      ceintureId,
      titre: row.lecon,
      ordre: ordreLecon[ordreKey],
    });
    count++;
  }
  console.log(`Classe 2/3 : ${count} lecons inserees/verifiees.`);
}

async function main() {
  console.log('Insertion du referentiel pedagogique...');
  await seedClasse1();
  await seedClasse23();
  console.log('Termine.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

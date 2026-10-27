import { PrismaClient } from '@prisma/client';

export const MOT_DE_PASSE_DEMO = 'Demo2026!Colibris';
export const DOMAINE_EMAIL = 'demo.colibris.test';

// À VÉRIFIER UNE FOIS dans votre application (GET /rh/postes, formulaire élève).
// Si vos libellés sont différents, changez-les ici : ils sont utilisés partout.
export const POSTES = {
  ENSEIGNANT: 'Enseignant',
  SECRETARIAT: 'Secrétariat',
  COMPTABLE: 'Comptable',
  ASSISTANT: 'Assistante',
};

// ---------- Générateur pseudo-aléatoire à graine (résultats reproductibles) ----------
export class Alea {
  private e: number;
  constructor(graine = 2026) { this.e = graine >>> 0; }
  suivant(): number {
    this.e = (this.e + 0x6d2b79f5) >>> 0;
    let t = this.e;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  entier(min: number, max: number): number { return min + Math.floor(this.suivant() * (max - min + 1)); }
  proba(p: number): boolean { return this.suivant() < p; }
  choisir<T>(liste: readonly T[]): T { return liste[this.entier(0, liste.length - 1)]; }
  melanger<T>(liste: readonly T[]): T[] {
    const a = [...liste];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.entier(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// ---------- Dates (Madagascar : UTC+3, sans heure d'été) ----------
export const DECALAGE_MS = 3 * 60 * 60 * 1000;
export const JOUR_MS = 86_400_000;
export const jourLocalIso = (d: Date = new Date()): string =>
  new Date(d.getTime() + DECALAGE_MS).toISOString().slice(0, 10);
export const enJour = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const ajouterJours = (iso: string, n: number): string =>
  new Date(enJour(iso).getTime() + n * JOUR_MS).toISOString().slice(0, 10);
export const estOuvre = (iso: string): boolean => {
  const j = enJour(iso).getUTCDay();
  return j >= 1 && j <= 5;
};
export const heureLocale = (iso: string, hhmm: string): Date => new Date(`${iso}T${hhmm}:00.000+03:00`);
export function derniersJoursOuvres(aujourdhui: string, nb: number): string[] {
  const out: string[] = [];
  let d = aujourdhui;
  while (out.length < nb) {
    if (estOuvre(d)) out.push(d);
    d = ajouterJours(d, -1);
  }
  return out.reverse();
}

// ---------- Texte ----------
export const pad = (n: number, l: number): string => String(n).padStart(l, '0');
export const sansAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const NOMS = [
  'Rakoto', 'Randria', 'Rabe', 'Ravelo', 'Rasolofo', 'Razafy', 'Ratsimba', 'Rajaonarison', 'Andrianarisoa',
  'Rakotomalala', 'Randrianasolo', 'Rasoanaivo', 'Rakotondrabe', 'Andriamanana', 'Razanamahefa',
  'Rakotoarivelo', 'Ratsiresy', 'Raveloson',
];
export const PRENOMS_F = [
  'Voahirana', 'Miora', 'Sarobidy', 'Fara', 'Lova', 'Anjara', 'Nomena', 'Tsiky', 'Hasina', 'Mirana',
  'Sarah', 'Emma', 'Lina', 'Aina', 'Fenitra', 'Mialy', 'Ony', 'Tiana', 'Noro', 'Zo',
];
export const PRENOMS_M = [
  'Tahiry', 'Fanilo', 'Mamy', 'Hery', 'Nirina', 'Antsa', 'Lalaina', 'Kevin', 'Mathis', 'Ryan',
  'Toky', 'Faly', 'Aro', 'Rado', 'Tojo', 'Mika', 'Andry', 'Fidy', 'Haja', 'Dina',
];
export const PROFESSIONS = [
  'Commerçant', 'Enseignant', 'Infirmière', 'Chauffeur', 'Ingénieur', 'Comptable', 'Couturière',
  'Médecin', 'Agriculteur', 'Employé de banque', 'Technicien', 'Cuisinière', 'Avocat', 'Pharmacienne',
];
export const QUARTIERS = [
  'Mahamasina', 'Ankorondrano', 'Analakely', 'Ambohijatovo', 'Isoraka', 'Behoririka', 'Ivandry',
  'Ampasamadinika', 'Andraharo', 'Tsaralalana', '67 Ha', 'Ankadifotsy',
];
export const BANQUES = ['BOA', 'BNI Madagascar', 'BFV-SG', 'BMOI'];

const nn = (a: Alea, n: number): string => pad(a.entier(0, 10 ** n - 1), n);
export const telephone = (a: Alea): string => `03${a.choisir([2, 3, 4])} ${nn(a, 2)} ${nn(a, 3)} ${nn(a, 2)}`;

// ---------- Contexte partagé entre les étapes ----------
export interface NiveauCtx { id: number; nom: string; ordre: number; cycle: string }
export interface SalleCtx {
  id: number; nom: string; niveaux: NiveauCtx[];
  enseignantPersonnelId?: number; enseignantUtilisateurId?: number;
}
export interface AgentCtx {
  personnelId: number; utilisateurId: number; nom: string; prenom: string; poste: string;
  role: 'ENSEIGNANT' | 'SECRETARIAT' | 'COMPTABLE'; salleId?: number; actif: boolean; dateDepart: Date | null;
}
export interface FamilleCtx {
  nom: string; parentIds: number[]; parentUtilisateurIds: number[]; eleveIds: number[];
  parentsAvecCompte: { parentId: number; utilisateurId: number }[];
}
export interface EleveCtx {
  eleveId: number; inscriptionId: number; salleId: number; niveauId: number; cycle: string;
  statut: 'validee' | 'en_attente'; rang: number; familleIdx: number;
  nom: string; prenom: string; dateNaissance: Date;
}
export interface CompteDemo { role: string; email: string; libelle: string }

export interface Ctx {
  prisma: PrismaClient;
  alea: Alea;
  hash: string;
  maintenant: Date;
  aujourdhui: string;
  annee: { id: number; libelle: string; dateDebut: Date; dateFin: Date };
  adminId: number;
  directriceId: number;
  directricePersonnelId: number | null;
  salles: SalleCtx[];
  agents: AgentCtx[];
  familles: FamilleCtx[];
  eleves: EleveCtx[];
  comptes: CompteDemo[];
  emailsPris: Set<string>;
  cinsPris: Set<string>;
  compteurPersonnel: number;
}

export function emailUnique(ctx: Ctx, base: string, domaine: string = DOMAINE_EMAIL): string {
  const racine = sansAccents(base).toLowerCase().replace(/[^a-z0-9.]+/g, '');
  let email = `${racine}@${domaine}`;
  let n = 1;
  while (ctx.emailsPris.has(email)) email = `${racine}${++n}@${domaine}`;
  ctx.emailsPris.add(email);
  return email;
}

// ---------- Environnement et garde-fous ----------
export function chargerEnv(): void {
  try { require('dotenv').config(); } catch { /* dotenv absent : on utilise l'environnement tel quel */ }
  if (process.env.DATABASE_URL_MIGRATION) process.env.DATABASE_URL = process.env.DATABASE_URL_MIGRATION;
}

export function verifierSecurite(): void {
  const refuser = (msg: string): never => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
  if (!process.argv.includes('--confirmer')) {
    refuser('Ce script EFFACE les données (sauf programmes, salles, niveaux, ceintures, admin, directrice). Lancez : npm run seed:demo');
  }
  if (process.env.NODE_ENV === 'production') refuser('NODE_ENV=production : exécution refusée.');
  const url = process.env.DATABASE_URL ?? '';
  let hote = '';
  try { hote = new URL(url).hostname; } catch { refuser("DATABASE_URL absente ou invalide."); }
  if (!['localhost', '127.0.0.1', '::1', 'db'].includes(hote) && !process.argv.includes('--forcer')) {
    refuser(`La base « ${hote} » n'est pas locale : exécution refusée (ajoutez --forcer si c'est voulu).`);
  }
}
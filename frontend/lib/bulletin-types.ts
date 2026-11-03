// Types du bulletin (contenu défini par l'administrateur, évalué par l'enseignante)

export type NiveauBulletin = 'A' | 'EA' | 'AR' | 'NA';

// Libellés affichés : un seul endroit à modifier si l'école change un intitulé
export const LIBELLES_NIVEAU: Record<NiveauBulletin, string> = {
  A: 'Acquis',
  EA: "En cours d'acquisition",
  AR: 'À renforcer',
  NA: 'Non acquis',
};

export const ORDRE_NIVEAUX: NiveauBulletin[] = ['A', 'EA', 'AR', 'NA'];

export interface LigneBulletin { id: number; libelle: string; niveau: NiveauBulletin | null; archive: boolean }
export interface RubriqueBulletin { id: number | null; titre: string | null; lignes: LigneBulletin[] }
export interface DisciplineBulletin { id: number; titre: string; rubriques: RubriqueBulletin[] }

export interface ResumeBulletin { A: number; EA: number; AR: number; NA: number; nonEvalue: number }
export interface ProgressionBulletin { evalue: number; total: number; complet: boolean }

// Examens blancs (7e) : un document à part par examen
export interface ExamenIndex { numero: number; date: string; complet: boolean }

export interface LigneExamen { discipline: string; coefficient: number; note: number | null; pondere: number | null }
export interface ExamenDocument {
  inscriptionId: number;
  eleve: { nom: string; prenom: string; matricule: string };
  salle: string; niveau: string; annee: string;
  numero: number; date: string;
  lignes: LigneExamen[];
  complet: boolean;
  totaux: { coefficients: number; notes: number | null; pondere: number | null };
  moyenneSimple: number | null;
  moyennePonderee: number | null;
  resultat: 'OUI' | 'NON' | null;
  enseignant: string | null;
  directrice: string | null;
}
export interface BulletinDetail {
  inscriptionId: number;
  eleve: { nom: string; prenom: string; matricule: string; dateNaissance: string };
  salle: string;
  niveau: string;
  annee: string;
  semestre: number;
  disciplines: DisciplineBulletin[];
  resume: ResumeBulletin;
  progression: ProgressionBulletin;
  examens: ExamenIndex[] | null;
  appreciation: string | null;
  publie: boolean;
  datePublication: string | null;
}

export interface EleveClasseBulletin {
  inscriptionId: number; nom: string; prenom: string; matricule: string;
  aAppreciation: boolean; publie: boolean;
  evalue: number; total: number; complet: boolean;
}
export interface ClasseBulletinsDetail {
  salle: { id: number; nom: string };
  total: number;
  eleves: EleveClasseBulletin[];
}

export interface ItemProgression { libelle: string; vu: boolean | null }
export interface SectionProgression { titre: string | null; items: ItemProgression[] }
export interface GroupeProgression { titre: string; statut: 'aucun' | 'en_cours' | 'termine' | null; sections: SectionProgression[] }
export interface CeintureProgression { nom: string; groupes: GroupeProgression[] }
export interface ProgressionParent {
  eleve: { nom: string; prenom: string };
  salle: string; niveau: string; annee: string; semestre: number;
  type: 'domaines' | 'lecons';
  ceintures: CeintureProgression[];
  resume: { fait: number; total: number };
}

export function recalculerResume(disciplines: DisciplineBulletin[]): { resume: ResumeBulletin; progression: ProgressionBulletin } {
  const resume: ResumeBulletin = { A: 0, EA: 0, AR: 0, NA: 0, nonEvalue: 0 };
  let total = 0, evalue = 0;
  for (const d of disciplines) for (const r of d.rubriques) for (const l of r.lignes) {
    if (l.niveau) resume[l.niveau]++; else resume.nonEvalue++;
    if (!l.archive) { total++; if (l.niveau) evalue++; }
  }
  return { resume, progression: { evalue, total, complet: total > 0 && evalue === total } };
}
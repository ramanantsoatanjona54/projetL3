// Reflète l'enum RoleUtilisateur du backend (prisma/schema.prisma)
export type Role = 'ADMIN' | 'ENSEIGNANT' | 'SECRETARIAT' | 'COMPTABLE' | 'DIRECTRICE' | 'PARENT';

export interface Utilisateur {
  id: number;
  email: string;
  role: Role;
  doitChangerMotDePasse?: boolean;
}

export interface LoginResponse {
  access_token: string;
  utilisateur: Utilisateur;
}
export interface Eleve {
  id: number;
  matricule: string;
  numeroInscription: string | null;
  nom: string;
  prenom: string;
  sexe: string; // à vérifier : "M"/"F" ou "Masculin"/"Féminin" côté backend
  dateNaissance: string;
  dateInscription: string | null;
  taille: number | null;
  dossiersManquants: string | null;
  assurance: string | null;
  assuranceExpiration: string | null;
  telephone: string | null;
  email1: string | null;
  email2: string | null;
  quartier: string | null;
  professionPere: string | null;
  professionMere: string | null;
  parents?: ParentEleve[];
  inscriptions?: InscriptionResume[];
}
export interface Parent {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string | null;
}

export interface ParentEleve {
  parentId: number;
  eleveId: number;
  lienParente: string; // "pere" | "mere" | "tuteur" (à confirmer côté backend)
  parent: Parent;
}

export interface InscriptionResume {
  id: number;
  statut: string; // "en_attente" | "validee"
  rangFratrie: number;
  dateInscription: string;
  salle?: { id: number; nom: string };
  niveau?: { id: number; nom: string };
  anneeScolaire?: { id: number; libelle?: string; nom?: string };
}
export interface AnneeScolaire { id: number; libelle: string; dateDebut: string; dateFin: string }
export interface Niveau { id: number; nom: string; ordre: number; classeId: number; classe?: { id: number; nom: string } }
export interface Salle { id: number; nom: string; anneeScolaireId: number | null; niveaux?: { id: number; nom: string }[] }

export interface ApercuInscription {
  rangFratrie: number;
  freres: { id: number; nom: string; prenom: string }[];
  aDesParents: boolean;
}

export interface InscriptionAttente {
  id: number; statut: string; rangFratrie: number; dateInscription: string;
  eleve: Eleve; salle: Salle; niveau: Niveau; anneeScolaire: AnneeScolaire;
}

export interface InscriptionFiche extends InscriptionAttente {
  eleve: Eleve; // avec parents
}

export interface ResultatValidation {
  statut: string;
  comptesGeneresPourParents: { email: string; motDePasseTemporaire: string }[];
  parentsSansEmail: number;
}
export interface Echeance {
  mois: number; datePrevue: string; limite: string; montant: number;
  statut: 'paye' | 'du' | 'en_retard' | 'a_venir'; joursRetard: number; penalite: number;
}
export interface PaiementLigne {
  id: number; mode: 'MENSUEL' | 'GLOBAL_ANNUEL'; montant: string; montantPenalite: string;
  moisConcerne: number | null; statut: string; dateEffective: string | null;
  numeroRecu: string | null; motifAnnulation: string | null;
}
export interface SituationPaiement {
  inscription: {
    id: number; statut: string; rangFratrie: number;
    eleve: { id: number; nom: string; prenom: string; matricule: string };
    salle: { nom: string }; niveau: { nom: string }; anneeScolaire: { libelle: string };
  };
  montantMensuel: number; totalAnnuel: number; totalPaye: number; penalitesEnCours: number;
  resteAPayer: number; annuelPaye: boolean; echeances: Echeance[]; paiements: PaiementLigne[];
}
export interface Recu extends PaiementLigne {
  inscriptionId: number; datePrevue: string; typeFrais: { libelle?: string; code: string };
  inscription: {
    eleve: { id: number; nom: string; prenom: string; matricule: string };
    salle: { nom: string }; niveau: { nom: string }; anneeScolaire: { libelle: string };
  };
}
export interface LigneRetard {
  inscriptionId: number;
  eleve: { id: number; nom: string; prenom: string; matricule: string;
    parents: { lienParente: string; parent: { nom: string; prenom: string; telephone: string } }[] };
  salle: { nom: string }; niveau: { nom: string };
  moisEnRetard: number[]; montantDu: number; penalites: number; joursRetardMax: number;
}

export interface Classe { id: number; nom: string; ordre: number }

export interface Frais {
  id: number;
  montant: string | number;
  dateMaj?: string | null;
  typeFrais?: { id?: number; code: string; libelle?: string };
}
export interface RemiseFratrie { id: number; rang: number; montant: string | number }
export interface ImpactBareme { annee: string | null; inscriptionsValidees: number }

export interface PersonnelOption { id: number; nom?: string; prenom?: string }
export interface UtilisateurLigne {
  id: number; email: string; role: string; actif: boolean; doitChangerMotDePasse: boolean;
  dateCreation: string; derniereConnexion: string | null; verrouilleJusqua: string | null;
  tentativesEchouees: number;
  personnel: PersonnelOption | null;
  parent: { id: number; nom: string; prenom: string } | null;
}

export interface PersonnelLigne {
  id: number; matricule: string; nom: string; prenom: string;
  sexe: string | null; dateNaissance: string | null; cin: string | null;
  adresse: string | null; telephone: string | null;
  indemniteTransportJour: string | number | null; numeroCnaps: string | null;
  poste: string; salleAffecteeId: number | null; salleAffectee: { id: number } | null;
  lieuAffectation: string | null; autorisationEnseigner: boolean; banque: string | null;
  dateEmbauche: string; dateDepart: string | null; dateRetraite: string | null;
  utilisateur: { id: number; email: string; role: string; actif: boolean } | null;
}

export interface PresenceAgent {
  id: number; matricule: string; nom: string; prenom: string; poste: string;
  pointage: { id: number; heureArrivee: string | null; heureDepart: string | null } | null;
}
export interface PresencesJour { date: string; ouvre: boolean; agents: PresenceAgent[] }
export interface RecapAgent {
  id: number; matricule: string; nom: string; prenom: string; poste: string;
  joursOuvres: number; joursPresents: number; absences: number; departsOublies: number;
  minutesTravaillees: number; indemniteTransport: number | null;
}
export interface RecapMois { mois: string; joursOuvresMois: number; agents: RecapAgent[] }

export interface EcheanceParent {
  mois: number; datePrevue: string; limite: string; montant: number;
  statut: 'paye' | 'du' | 'en_retard' | 'a_venir'; joursRetard: number; penalite: number;
}
export interface PaiementParent {
  id: number; mode: string; moisConcerne: number | null; montant: number; montantPenalite: number;
  dateEffective: string | null; numeroRecu: string | null;
}
export interface SituationParent {
  inscription: {
    id: number; statut: string; rangFratrie: number;
    eleve: { id: number; nom: string; prenom: string; matricule: string };
    salle: { nom: string }; niveau: { nom: string }; anneeScolaire: { libelle: string };
  };
  montantMensuel: number; totalAnnuel: number; totalPaye: number; annuelPaye: boolean;
  penalitesEnCours: number; resteAPayer: number;
  echeances: EcheanceParent[]; paiements: PaiementParent[];
}
export interface RecuParent {
  numeroRecu: string | null; dateEffective: string | null; mode: string; moisConcerne: number | null;
  montant: number; montantPenalite: number; typeFrais: string | null;
  eleve: { id: number; nom: string; prenom: string; matricule: string };
  salle: string; niveau: string; anneeScolaire: string;
}
export interface ResumeFinance {
  totalAnnuel: number; totalPaye: number; resteAPayer: number; exigible: number; penalitesEnCours: number;
  moisEnRetard: number[];
  prochaine: { mois: number; limite: string; montant: number; statut: string } | null;
}
export interface InscriptionParent {
  id: number; statut: string; rangFratrie: number; courante: boolean;
  anneeScolaire: { id: number; libelle: string }; salle: { nom: string }; niveau: { nom: string };
  resume: ResumeFinance | null;
}
export interface EnfantParent {
  id: number; matricule: string; nom: string; prenom: string; sexe: string; dateNaissance: string;
  lienParente: string; inscriptions: InscriptionParent[];
}
export interface EspaceParent {
  parent: { nom: string; prenom: string; telephone: string; email: string | null } | null;
  enfants: EnfantParent[];
}
export interface LigneAudit {
  id: number; date: string | null;
  utilisateur: { id: number; email: string; role: string } | null;
  action: string; entite: string | null; entiteId: number | null; details: unknown;
}
export interface PageAudit { total: number; page: number; taille: number; lignes: LigneAudit[] }
export interface FiltresAudit { actions: string[]; entites: string[]; utilisateurs: { id: number; email: string }[] }

export interface LigneRetardTableau {
  inscriptionId: number; eleve: string; salle: string; montantDu: number; penalites: number; moisEnRetard: number[];
}
export interface TableauDeBord {
  role: string;
  anneeScolaire: { id: number; libelle: string } | null;
  eleves?: {
    effectif: number; enAttente: number;
    parSalle: { salle: string; effectif: number }[];
    attente: { id: number; eleve: string; salle: string; dateInscription: string }[];
  };
  finances?: {
    encaisseMois: number; nbPaiementsMois: number;
    retards: { nombre: number; montantDu: number; penalites: number; plusGros: LigneRetardTableau[] };
    derniersPaiements?: {
      id: number; inscriptionId: number; numeroRecu: string | null; total: number; mode: string;
      moisConcerne: number | null; dateEffective: string | null; eleve: string;
    }[];
  };
  personnel?: { enPoste: number; presentsAujourdhui: number; jourOuvre: boolean };
  comptes?: { actifs: number; desactives: number; verrouilles: number; motDePasseTemporaire: number };
  activiteRecente?: LigneAudit[];
}
export interface SalleSimple { id: number; nom: string }
export interface EleveAppel {
  inscriptionId: number; nom: string; prenom: string; matricule: string;
  absence: { id: number; justifiee: boolean; motif: string | null } | null;
}
export interface AppelJour {
  salle: SalleSimple; date: string; ouvre: boolean;
  anneeScolaire: { id: number; libelle: string } | null; eleves: EleveAppel[];
}
export interface LigneAbsence {
  id: number; date: string; justifiee: boolean; motif: string | null; inscriptionId: number;
  eleve: { id: number; nom: string; prenom: string; matricule: string }; salle: string; saisiPar: string | null;
}
export interface PageAbsences { total: number; page: number; taille: number; lignes: LigneAbsence[] }
export interface AbsencesParent {
  eleve: { prenom: string; nom: string }; salle: string; anneeScolaire: string;
  total: number; justifiees: number; nonJustifiees: number;
  absences: { id: number; date: string; justifiee: boolean; motif: string | null }[];
}
export interface NotificationLigne { id: number; message: string; lu: boolean; date: string }
export interface MesNotifications { nonLues: number; notifications: NotificationLigne[] }
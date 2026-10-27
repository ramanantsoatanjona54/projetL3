// Reflète l'enum RoleUtilisateur du backend (prisma/schema.prisma)
export type Role = 'ADMIN' | 'ENSEIGNANT' | 'SECRETARIAT' | 'COMPTABLE' | 'DIRECTRICE' | 'PARENT';

export interface Utilisateur {
  id: number;
  email: string;
  role: Role;
  doitChangerMotDePasse?: boolean;
  doitActiver2fa?: boolean;
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
  paiementGlobal: {
    montant: number; montantSansRemise: number; remiseAppliquee: boolean;
    economie: number; dateLimite: string;
  };
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

export type StatutRdv = 'DEMANDE' | 'CONFIRME' | 'ANNULE' | 'TERMINE';
export interface InterlocuteurParent { utilisateurId: number; nom: string; fonction: string }
export interface OptionsRdv { interlocuteurs: InterlocuteurParent[]; creneaux: string[]; delaiMinHeures: number; horizonJours: number }
export interface RdvParent { id: number; dateHeure: string; statut: StatutRdv; motif: string | null; interlocuteur: string; peutAnnuler: boolean }
export interface ContactParent { nom: string; prenom: string; telephone: string }
export interface LigneRdv {
  id: number; dateHeure: string; statut: StatutRdv; motif: string | null; interlocuteur: string;
  parent: ContactParent; enfants: string[]; peutTerminer: boolean;
}
export interface PageRdv { total: number; page: number; taille: number; lignes: LigneRdv[] }
export interface RemarqueDuParent { id: number; contenu: string; traitee: boolean; date: string }
export interface LigneRemarque { id: number; contenu: string; traitee: boolean; date: string; parent: ContactParent; enfants: string[] }
export interface PageRemarques { total: number; page: number; taille: number; lignes: LigneRemarque[] }

export interface PublicationEcole { id: number; titre: string; contenu: string; type: string; visiblePublic: boolean; date: string }
export interface PagePublications { total: number; page: number; taille: number; lignes: PublicationEcole[] }
export interface DossierLigne {
  id: number; titre: string; type: string | null; date: string; nomOriginal: string | null;
  mime: string | null; taille: number | null; aFichier: boolean; deposePar: string | null; peutSupprimer: boolean;
}
export interface PageDossiers { total: number; page: number; taille: number; lignes: DossierLigne[] ,   typesAutorises: string[];}
export interface MenuDuJour { entree: string | null; platPrincipal: string | null; dessert: string | null }
export interface JourMenuSemaine { date: string; periode: { id: number; nom: string } | null; menu: MenuDuJour | null }
export interface SemaineMenu { lundi: string; vendredi: string; jours: JourMenuSemaine[] }
export interface PeriodeMenuLigne { id: number; nom: string; dateDebut: string; dateFin: string; nbJours: number }

export interface CreneauEdt {
  id: number; jourSemaine: number; heureDebut: string; heureFin: string; titre: string | null;
  matiere: { id: number; nom: string } | null;
  enseignant: { id: number; nom: string; prenom: string } | null;
}

export interface SalleEdt { id: number; nom: string; niveaux: { id: number; nom: string }[] }
export interface EdtSalle {
  salle: { id: number; nom: string }; niveau: { id: number; nom: string }; annee: { id: number; libelle: string };
  creneaux: CreneauEdt[]; enseignantsPossibles: { id: number; nom: string; prenom: string }[]; matieres: { id: number; nom: string }[];
}
export interface EdtParent { salle: { id: number; nom: string; niveau: string }; eleve: { prenom: string; nom: string }; creneaux: CreneauEdt[] }

export type TypeArticle = 'MOBILIER' | 'FOURNITURE' | 'AUTRE';
export interface ArticleInventaire { id: number; libelle: string; type: TypeArticle; quantite: number; dateMaj: string }
export interface PageInventaire { total: number; page: number; taille: number; enRupture: number; lignes: ArticleInventaire[] }
export interface LigneMouvement { id: number; type: 'ENTREE' | 'SORTIE'; quantite: number; motif: string | null; date: string; par: string }
export interface HistoriqueInventaire {
  article: { id: number; libelle: string; type: TypeArticle; quantite: number };
  total: number; page: number; taille: number; lignes: LigneMouvement[];
}

export type NiveauAcquis = 'A' | 'EA' | 'AR';
export interface SallePedago { id: number; nom: string; niveaux: { id: number; nom: string }[] }
export interface CeinturesPedago {
  type: 'domaines' | 'lecons'; effectif: number; ceintures: { id: number; nom: string; semestre: number }[];
}
export interface ElementPedago { id: number; libelle: string; evalues: number; vu?: boolean }
export interface SectionPedago { titre: string | null; elements: ElementPedago[] }
export interface GroupePedago { id: number; titre: string; statut?: string | null; sections: SectionPedago[] }
export interface ElementsPedago { type: 'domaines' | 'lecons'; effectif: number; groupes: GroupePedago[] }
export interface EleveEvaluation { inscriptionId: number; nom: string; prenom: string; matricule: string; niveau: NiveauAcquis | null }
export interface EvaluationsElement { element: { id: number; libelle: string }; eleves: EleveEvaluation[] }

export interface DisciplineExamenListe { id: number; matiereId: number; nom: string; coefficient: number; notes: number }
export interface ExamenListe { id: number; numero: number; date: string; totalNotes: number; disciplines: DisciplineExamenListe[] }
export interface ListeExamens { niveau: { id: number; nom: string }; examens: ExamenListe[] }
export interface MatiereExamen { id: number; nom: string }
export interface SalleExamen { id: number; nom: string }
export interface EleveExamen {
  inscriptionId: number; nom: string; prenom: string; matricule: string;
  notes: Record<number, number | null>; moyenne: number | null; complete: boolean;
}
export interface DetailExamen {
  examen: { id: number; numero: number; date: string; disciplines: { id: number; nom: string; coefficient: number }[] };
  salle: { id: number; nom: string };
  peutSaisir: boolean;
  moyenneClasse: number | null;
  moyennesDisciplines: Record<number, number | null>;
  eleves: EleveExamen[];
}

export interface ItemBulletin { libelle: string; niveau: NiveauAcquis | null }
export interface SectionBulletin { titre: string | null; items: ItemBulletin[] }
export interface GroupeBulletin { titre: string; sections: SectionBulletin[] }
export interface CeintureBulletin { nom: string; groupes: GroupeBulletin[] }
export interface ExamenBulletin {
  numero: number; date: string; moyenne: number | null;
  notes: { discipline: string; coefficient: number; note: number | null }[];
}
export interface Bulletin {
  inscriptionId: number;
  eleve: { nom: string; prenom: string; matricule: string; dateNaissance: string };
  salle: string; niveau: string; annee: string; semestre: number;
  type: 'domaines' | 'lecons';
  ceintures: CeintureBulletin[];
  resume: { A: number; EA: number; AR: number; nonEvalue: number };
  examens: ExamenBulletin[] | null;
  appreciation: string | null;
  publie: boolean;
  datePublication: string | null;
}
export interface ClasseBulletins {
  salle: { id: number; nom: string };
  eleves: { inscriptionId: number; nom: string; prenom: string; matricule: string; aAppreciation: boolean; publie: boolean }[];
}
export interface SemestreBulletin { semestre: number; datePublication: string | null }

export interface AnneeBulletin { id: number; libelle: string; courante: boolean }
export interface HistoriqueBulletins {
  eleve: string;
  inscriptions: { inscriptionId: number; annee: string; niveau: string; semestres: SemestreBulletin[] }[];
}

export interface AvancementSemestre {
  semestre: number; effectif: number; elements: number; attendues: number; saisies: number;
  suiviTotal: number; suivi: number; bulletinsRediges: number;
}
export interface NiveauEspace { id: number; nom: string; type: 'domaines' | 'lecons'; effectif: number; avancement: AvancementSemestre[] }
export interface AccueilEnseignant {
  enseignant: { prenom: string; nom: string };
  salle: null | { id: number; nom: string; effectif: number; niveaux: NiveauEspace[] };
  aujourdhui: string; jourOuvre: boolean;
  absentsAujourdhui?: { prenom: string; nom: string; justifiee: boolean }[];
  cours?: { debut: string; fin: string; niveau: string; libelle: string }[];
  rendezVous?: { id: number; dateHeure: string; statut: string; motif: string | null; parent: string }[];
  examens?: { id: number; numero: number; date: string; passe: boolean; saisies: number; attendues: number }[];
}
export interface EleveSalle {
  inscriptionId: number; nom: string; prenom: string; matricule: string; sexe: string;
  dateNaissance: string; niveau: string; absences: number; nonJustifiees: number;
}

export interface EnseignantSalle { id: number; nom: string; compteEnseignant: boolean }
export interface SalleAffectation {
  id: number; nom: string; inscrits: number;
  anneeScolaire: { id: number; libelle: string } | null;
  niveaux: { id: number; nom: string; classe: { nom: string; ordre: number } | null }[];
  enseignants: EnseignantSalle[];
}
export interface EnseignantAffectation {
  id: number; nom: string; matricule: string; poste: string;
  salle: { id: number; nom: string } | null; compteEnseignant: boolean;
}
export interface NiveauProgramme { id: number; nom: string; classe: { nom: string; cycle: string } }
export interface MatiereProgramme { id: number; nom: string; rubriques: { id: number; nom: string; _count: { lecons: number } }[] }
export interface CompetenceProg { id: number; libelle: string; _count: { notes: number } }
export interface DomaineProg {
  id: number; nom: string; _count: { progressions: number };
  competences: CompetenceProg[];
  sousDomaines: { id: number; nom: string; competences: CompetenceProg[] }[];
}
export interface LeconProg {
  id: number; titre: string; ordre: number;
  matiere: { id: number; nom: string }; rubrique: { id: number; nom: string } | null;
  _count: { notes: number; progressions: number };
}
export interface ArbreProgramme {
  niveau: { id: number; nom: string; classe: { nom: string; cycle: string } };
  type: 'domaines' | 'lecons';
  semestres: { id: number; numero: number; ceintures: { id: number; nom: string; domaines: DomaineProg[]; lecons: LeconProg[] }[] }[];
}
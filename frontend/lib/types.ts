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
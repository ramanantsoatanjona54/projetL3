export const LIBELLES_ACTION: Record<string, string> = {
  CONNEXION_REUSSIE: 'Connexion réussie',
  CONNEXION_ECHEC: 'Échec de connexion',
  COMPTE_VERROUILLE: 'Compte verrouillé',
  CONNEXION_REFUSEE_COMPTE_DESACTIVE: 'Connexion refusée (compte désactivé)',
  MOT_DE_PASSE_CHANGE: 'Mot de passe changé',
  MOT_DE_PASSE_REINITIALISE: 'Mot de passe réinitialisé',
  UTILISATEUR_CREE: 'Compte créé',
  UTILISATEUR_MODIFIE: 'Compte modifié',
  UTILISATEUR_DEVERROUILLE: 'Compte déverrouillé',
  INSCRIPTION_CREEE: 'Inscription créée',
  INSCRIPTION_VALIDEE: 'Inscription validée',
  INSCRIPTION_ANNULEE: 'Inscription annulée',
  PAIEMENT_ENREGISTRE: 'Paiement enregistré',
  PAIEMENT_ANNULE: 'Paiement annulé',
  FRAIS_MODIFIE: 'Tarif modifié',
  REMISE_FRATERNITE_MODIFIEE: 'Remise de fratrie modifiée',
  ANNEE_CREEE: 'Année scolaire créée',
  ANNEE_MODIFIEE: 'Année scolaire modifiée',
  ANNEE_SUPPRIMEE: 'Année scolaire supprimée',
  PERSONNEL_CREE: 'Fiche du personnel créée',
  PERSONNEL_MODIFIE: 'Fiche du personnel modifiée',
  PERSONNEL_DEPART: 'Départ du personnel',
  POINTAGE_CORRIGE: 'Pointage corrigé',
  POINTAGE_SAISI_MANUELLEMENT: 'Pointage saisi manuellement',
  POINTAGE_ANNULE: 'Pointage annulé',
};

// Action inconnue : on affiche un libellé lisible dérivé du code
export function libelleAction(code: string): string {
  if (LIBELLES_ACTION[code]) return LIBELLES_ACTION[code];
  const t = code.toLowerCase().replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short', timeStyle: 'medium', timeZone: 'Indian/Antananarivo',
  });
}
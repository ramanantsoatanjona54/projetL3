const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const nomMoisNumero = (m: number | null) => (m && MOIS[m - 1] ? MOIS[m - 1] : '');

export const libelleEcheance: Record<string, string> = {
  paye: 'Payé', du: 'À payer', en_retard: 'En retard', a_venir: 'À venir',
};

export const varianteEcheance = {
  paye: 'default', du: 'secondary', en_retard: 'destructive', a_venir: 'outline',
} as const;

export const libelleMode = (m: string) => (m === 'GLOBAL_ANNUEL' ? 'Paiement annuel' : 'Paiement mensuel');

export const libelleLien: Record<string, string> = { pere: 'Père', mere: 'Mère', tuteur: 'Tuteur' };
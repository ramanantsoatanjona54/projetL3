import type { StatutRdv } from '@/lib/types';

export const LIBELLE_STATUT: Record<StatutRdv, string> = {
  DEMANDE: 'En attente',
  CONFIRME: 'Confirmé',
  ANNULE: 'Annulé',
  TERMINE: 'Terminé',
};

export const VARIANTE_STATUT: Record<StatutRdv, 'default' | 'secondary' | 'outline'> = {
  DEMANDE: 'outline',
  CONFIRME: 'default',
  ANNULE: 'secondary',
  TERMINE: 'secondary',
};
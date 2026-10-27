import { decalerJour } from '@/lib/pointage';

export const LIBELLE_TYPE_PUBLICATION: Record<string, string> = {
  ANNONCE: 'Annonce',
  EVENEMENT: 'Événement',
  RAPPEL: 'Rappel',
  URGENT: 'Urgent',
};
export const TYPES_PUBLICATION = Object.keys(LIBELLE_TYPE_PUBLICATION);
export const TYPES_DOSSIER = ['Circulaire', 'Support de cours', 'Administratif', 'Autre'];
export const EXTENSIONS_ACCEPTEES = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'jpeg'];
export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

// Lundi de la semaine qui contient la date (AAAA-MM-JJ)
export function lundiDe(iso: string): string {
  const jour = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return decalerJour(iso, -((jour + 6) % 7));
}

export function jourLong(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

export function tailleLisible(octets: number | null): string {
  if (octets === null) return '';
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export async function lireErreurHttp(r: Response): Promise<string> {
  if (r.status === 413) return 'Fichier trop volumineux (10 Mo maximum).';
  try {
    const j = await r.json();
    const m = j?.message;
    return Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : 'Une erreur est survenue.';
  } catch {
    return 'Une erreur est survenue.';
  }
}
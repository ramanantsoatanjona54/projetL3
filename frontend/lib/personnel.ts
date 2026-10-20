export const nomComplet = (p: { nom: string; prenom: string }) => `${p.prenom} ${p.nom}`;

// Prend le premier champ texte connu de la salle (nom, libellé ou code), sinon son numéro
export function libelleSalle(s: { id: number }): string {
  const r = s as unknown as Record<string, unknown>;
  const t = r.nom ?? r.libelle ?? r.code;
  return typeof t === 'string' && t ? t : `Salle n°${s.id}`;
}

export const jourIso = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export const cinNormalise = (v: string) => v.replace(/[\s.\-]/g, '').toUpperCase();
// Règles de validation communes (écrans) — miroir de src/common/validation.ts côté serveur.
// Le serveur reste l'autorité : ces règles évitent seulement d'attendre sa réponse.

export const LONGUEUR_TELEPHONE = 10;
const NOM_PROPRE = /^[\p{L}][\p{L}\s'’-]*$/u;

// Frappe ou collage d'un téléphone : on garde les chiffres, on convertit +261, on limite à 10
export function saisieTelephone(brut: string): string {
  let c = brut.replace(/\D/g, '');
  if (c.startsWith('00261')) c = '0' + c.slice(5);
  else if (c.startsWith('261') && c.length > LONGUEUR_TELEPHONE) c = '0' + c.slice(3);
  return c.slice(0, LONGUEUR_TELEPHONE);
}

// Frappe d'un numéro (CIN, NIF...) : chiffres uniquement, longueur limitée
export function saisieChiffres(brut: string, max: number): string {
  return brut.replace(/\D/g, '').slice(0, max);
}

// Frappe d'un nom : on retire les chiffres et les symboles
export function saisieNom(brut: string): string {
  return brut.replace(/[^\p{L}\s'’-]/gu, '');
}

export function erreurTelephone(v: string, obligatoire = false): string | null {
  const t = v.trim();
  if (!t) return obligatoire ? 'Le téléphone est obligatoire.' : null;
  return /^\d{10}$/.test(t) ? null : `Le téléphone doit contenir exactement ${LONGUEUR_TELEPHONE} chiffres.`;
}

export function erreurNom(v: string, libelle: string, obligatoire = true): string | null {
  const t = v.trim();
  if (!t) return obligatoire ? `${libelle} est obligatoire.` : null;
  return NOM_PROPRE.test(t) ? null : `${libelle} ne doit contenir que des lettres.`;
}

export function erreurNumero(v: string, libelle: string, max: number, obligatoire = false): string | null {
  const t = v.trim();
  if (!t) return obligatoire ? `${libelle} est obligatoire.` : null;
  return new RegExp(`^\\d{1,${max}}$`).test(t) ? null : `${libelle} ne doit contenir que des chiffres (${max} au maximum).`;
}
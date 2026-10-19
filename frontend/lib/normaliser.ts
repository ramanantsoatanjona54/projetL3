// "  Éloïse  RAKOTO " -> "eloise rakoto" : sert à comparer sans piège d'accents/majuscules
export const normaliser = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
import type { TypeArticle } from '@/lib/types';

export const LIBELLE_TYPE_ARTICLE: Record<TypeArticle, string> = {
  MOBILIER: 'Mobilier',
  FOURNITURE: 'Fourniture',
  AUTRE: 'Autre',
};
export const TYPES_ARTICLE = Object.keys(LIBELLE_TYPE_ARTICLE) as TypeArticle[];
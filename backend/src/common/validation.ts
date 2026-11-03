import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches, MaxLength } from 'class-validator';

/**
 * Règles de validation communes (serveur) — une seule définition pour tout le projet.
 * - Téléphone : chiffres uniquement, exactement 10 (ex. 0341234567).
 * - Nom propre (nom, prénom, profession...) : lettres, espaces, apostrophes et tirets, sans chiffres.
 * - Numéro (CIN, NIF...) : chiffres uniquement, longueur maximale donnée.
 */

export const LONGUEUR_TELEPHONE = 10;
export const TELEPHONE_REGEX = new RegExp(`^\\d{${LONGUEUR_TELEPHONE}}$`);
export const NOM_PROPRE_REGEX = /^[\p{L}][\p{L}\s'’-]*$/u;

// "034 12 345 67", "034-12-345-67", "+261 34 12 345 67" -> "0341234567"
export function normaliserTelephone(brut: unknown): unknown {
  if (typeof brut !== 'string') return brut;
  let c = brut.replace(/\D/g, '');
  if (c.startsWith('00261')) c = '0' + c.slice(5);
  else if (c.startsWith('261') && c.length === 12) c = '0' + c.slice(3);
  return c;
}

export function EstTelephone() {
  return applyDecorators(
    Transform(({ value }) => normaliserTelephone(value)),
    Matches(TELEPHONE_REGEX, {
      message: `Le numéro de téléphone doit contenir exactement ${LONGUEUR_TELEPHONE} chiffres (ex. 0341234567).`,
    }),
  );
}

export function EstNomPropre(libelle = 'Ce champ', max = 100) {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value)),
    MaxLength(max, { message: `${libelle} ne doit pas dépasser ${max} caractères.` }),
    Matches(NOM_PROPRE_REGEX, {
      message: `${libelle} ne doit contenir que des lettres (espaces, apostrophes et tirets permis).`,
    }),
  );
}

export function EstNumeroChiffres(libelle: string, max: number) {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value)),
    Matches(new RegExp(`^\\d{1,${max}}$`), {
      message: `${libelle} ne doit contenir que des chiffres (${max} au maximum).`,
    }),
  );
}
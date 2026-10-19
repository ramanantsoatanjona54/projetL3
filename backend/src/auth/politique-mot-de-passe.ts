import { randomInt } from 'crypto';

// Politique : 10 à 64 caractères, avec minuscule, majuscule, chiffre et symbole
export const REGEX_MOT_DE_PASSE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,64}$/;
export const MESSAGE_MOT_DE_PASSE =
  'Le mot de passe doit contenir de 10 à 64 caractères, avec au moins une minuscule, une majuscule, un chiffre et un symbole.';

// Alphabets sans caractères ambigus (l, 1, I, O, 0) : le mot de passe est souvent transmis à l'oral ou à la main
const MINUSCULES = 'abcdefghijkmnpqrstuvwxyz';
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHIFFRES = '23456789';
const SYMBOLES = '!#$%&*+-=?@';

const tirer = (alphabet: string) => alphabet[randomInt(alphabet.length)];

export function genererMotDePasseTemporaire(longueur = 12): string {
  const tous = MINUSCULES + MAJUSCULES + CHIFFRES + SYMBOLES;
  const caracteres = [tirer(MINUSCULES), tirer(MAJUSCULES), tirer(CHIFFRES), tirer(SYMBOLES)];
  while (caracteres.length < longueur) caracteres.push(tirer(tous));
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
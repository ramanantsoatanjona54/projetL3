import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'crypto';

function cle(): Buffer {
  const k = process.env.TOTP_CLE;
  if (!k || !/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error('TOTP_CLE manquante ou invalide dans .env (64 caractères hexadécimaux, soit 32 octets).');
  }
  return Buffer.from(k, 'hex');
}
export const verifierCle = () => void cle(); // appelé au démarrage

// AES-256-GCM : confidentialité + détection de toute altération
export function chiffrer(texte: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cle(), iv);
  const enc = Buffer.concat([c.update(texte, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function dechiffrer(valeur: string): string {
  const [iv, tag, enc] = valeur.split('.').map((p) => Buffer.from(p, 'base64'));
  const d = createDecipheriv('aes-256-gcm', cle(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

const normaliser = (code: string) => code.replace(/[\s-]/g, '').toUpperCase();
export const empreinte = (code: string) => createHash('sha256').update(normaliser(code)).digest('hex');

// Alphabet sans caractères ambigus (0/O, 1/I) : ces codes sont recopiés à la main
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genererCodesSecours(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const c = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}
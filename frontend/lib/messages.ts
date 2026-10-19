import { ApiError } from '@/lib/api';

export const messageErreur = (e: unknown) =>
  e instanceof ApiError
    ? e.message
    : 'Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.';
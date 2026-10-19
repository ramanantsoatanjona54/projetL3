'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import type { Utilisateur } from '@/lib/types';

interface AuthContextValue {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  seConnecter: (email: string, motDePasse: string) => Promise<void>;
  seDeconnecter: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const CLE_UTILISATEUR = 'utilisateur';
const EVENEMENT_AUTH = 'auth-change';

// --- Petit "store" basé sur localStorage ---

function abonner(callback: () => void) {
  window.addEventListener('storage', callback); // autres onglets
  window.addEventListener(EVENEMENT_AUTH, callback); // même onglet
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENEMENT_AUTH, callback);
  };
}

function lireBrut(): string | null {
  return localStorage.getItem(CLE_UTILISATEUR);
}

// Rendu serveur : on ne connaît pas encore l'utilisateur
function lireBrutServeur(): string | null {
  return null;
}

function notifier() {
  window.dispatchEvent(new Event(EVENEMENT_AUTH));
}

// Fournit l'utilisateur connecté à toute l'application (via localStorage + état React).
// Pas de gestion de session côté serveur ici : le token JWT porte l'identité,
// vérifiée à chaque requête par le backend (JwtAuthGuard + RolesGuard).
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const brut = useSyncExternalStore(abonner, lireBrut, lireBrutServeur);

  // Vrai uniquement pendant le rendu serveur / l'hydratation
  const estHydrate = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const utilisateur = useMemo<Utilisateur | null>(() => {
    if (!brut) return null;
    try {
      return JSON.parse(brut) as Utilisateur;
    } catch {
      return null;
    }
  }, [brut]);

  const chargement = !estHydrate;

 const seConnecter = useCallback(
  async (email: string, motDePasse: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, motDePasse }),
    });
    const data = await res.json();

    if (!res.ok) {
      const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      throw new ApiError(res.status, message ?? 'Connexion impossible');
    }
    if (!data.utilisateur) {
      throw new ApiError(500, 'Réponse de connexion invalide (utilisateur manquant)');
    }

    localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(data.utilisateur));
    notifier();
    router.push('/dashboard');
  },
  [router],
);

const seDeconnecter = useCallback(async () => {
  await fetch('/api/logout', { method: 'POST' });
  localStorage.removeItem(CLE_UTILISATEUR);
  notifier();
  router.push('/login');
}, [router]);



  const value = useMemo(
    () => ({ utilisateur, chargement, seConnecter, seDeconnecter }),
    [utilisateur, chargement, seConnecter, seDeconnecter],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}

export { ApiError };
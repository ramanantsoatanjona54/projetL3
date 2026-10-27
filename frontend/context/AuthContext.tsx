'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import type { Utilisateur } from '@/lib/types';

interface AuthContextValue {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  defi2fa: string | null; // non nul = l'utilisateur doit saisir son code à 6 chiffres
  seConnecter: (email: string, motDePasse: string) => Promise<void>;
  validerCode: (code: string) => Promise<void>;
  annulerDefi: () => void;
  mettreAJourUtilisateur: (modif: Partial<Utilisateur>) => void;
  seDeconnecter: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const CLE_UTILISATEUR = 'utilisateur';
const EVENEMENT_AUTH = 'auth-change';

function abonner(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENEMENT_AUTH, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENEMENT_AUTH, callback);
  };
}
const lireBrut = (): string | null => localStorage.getItem(CLE_UTILISATEUR);
const lireBrutServeur = (): string | null => null;
const notifier = () => window.dispatchEvent(new Event(EVENEMENT_AUTH));

async function appeler(url: string, corps: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new ApiError(res.status, message ?? 'Connexion impossible');
  }
  return data;
}

// Le localStorage ne contient que des informations d'affichage (id, email, rôle). Le jeton est dans un cookie HttpOnly
// et le serveur revérifie session, compte et rôle à chaque requête.
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const brut = useSyncExternalStore(abonner, lireBrut, lireBrutServeur);
  const estHydrate = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [defi2fa, setDefi2fa] = useState<string | null>(null);

  const utilisateur = useMemo<Utilisateur | null>(() => {
    if (!brut) return null;
    try { return JSON.parse(brut) as Utilisateur; } catch { return null; }
  }, [brut]);

  const terminer = useCallback((u: Utilisateur) => {
    localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(u));
    notifier();
    setDefi2fa(null);
    router.push('/dashboard');
  }, [router]);

  const seConnecter = useCallback(async (email: string, motDePasse: string) => {
    const data = await appeler('/api/login', { email, motDePasse });
    if (data.etape === '2fa') { setDefi2fa(data.jetonDefi); return; }
    if (!data.utilisateur) throw new ApiError(500, 'Réponse de connexion invalide (utilisateur manquant)');
    terminer(data.utilisateur);
  }, [terminer]);

  const validerCode = useCallback(async (code: string) => {
    if (!defi2fa) throw new ApiError(400, 'Recommencez la connexion.');
    const data = await appeler('/api/login/2fa', { jetonDefi: defi2fa, code });
    if (!data.utilisateur) throw new ApiError(500, 'Réponse de connexion invalide (utilisateur manquant)');
    terminer(data.utilisateur);
  }, [defi2fa, terminer]);

  const mettreAJourUtilisateur = useCallback((modif: Partial<Utilisateur>) => {
    const courant = lireBrut();
    if (!courant) return;
    try {
      localStorage.setItem(CLE_UTILISATEUR, JSON.stringify({ ...JSON.parse(courant), ...modif }));
      notifier();
    } catch { /* stockage indisponible : l'interface se corrigera au prochain chargement */ }
  }, []);

  const seDeconnecter = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem(CLE_UTILISATEUR);
    notifier();
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({
      utilisateur, chargement: !estHydrate, defi2fa, seConnecter, validerCode,
      annulerDefi: () => setDefi2fa(null), mettreAJourUtilisateur, seDeconnecter,
    }),
    [utilisateur, estHydrate, defi2fa, seConnecter, validerCode, mettreAJourUtilisateur, seDeconnecter],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}

export { ApiError };
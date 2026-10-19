'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import type { Role } from '@/lib/types';

// Protège une page côté client : redirige vers /login si personne n'est connecté,
// et optionnellement filtre par rôle (ex. <RequireAuth roles={['ADMIN']}>).
// Rappel sécurité : ceci est un confort d'UX, pas une barrière de sécurité —
// la vraie vérification a lieu côté backend (JwtAuthGuard + RolesGuard) à chaque requête.
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { utilisateur, chargement } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (chargement) return;
    if (!utilisateur) {
      router.push('/login');
      return;
    }
    if (roles && !roles.includes(utilisateur.role)) {
      router.push('/dashboard');
    }
  }, [chargement, utilisateur, roles, router]);

  if (chargement || !utilisateur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F2]">
        <p className="text-sm text-[#0D0D0D]/50">Chargement...</p>
      </div>
    );
  }

  return <>{children}</>;
}

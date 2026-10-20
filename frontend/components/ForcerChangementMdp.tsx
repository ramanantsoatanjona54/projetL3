'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// 1) Tant que le mot de passe temporaire n'est pas changé, tout ramène à la page de changement.
// 2) Un compte parent reste dans son espace, ses notifications et son mot de passe.
export function ForcerChangementMdp() {
  const { utilisateur } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!utilisateur) return;
    if (utilisateur.doitChangerMotDePasse) {
      if (pathname !== '/dashboard/mot-de-passe') router.replace('/dashboard/mot-de-passe');
      return;
    }
    const autorisePourParent =
      pathname.startsWith('/dashboard/parent') ||
      pathname === '/dashboard/mot-de-passe' ||
      pathname === '/dashboard/notifications';
    if (utilisateur.role === 'PARENT' && !autorisePourParent) router.replace('/dashboard/parent');
  }, [utilisateur, pathname, router]);

  return null;
}
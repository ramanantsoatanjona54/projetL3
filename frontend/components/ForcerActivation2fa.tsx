'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// Un administrateur sans 2FA est renvoyé vers la page de configuration (le serveur bloque de toute façon le reste)
export function ForcerActivation2fa() {
  const { utilisateur } = useAuth();
  const chemin = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (utilisateur?.doitActiver2fa && chemin !== '/dashboard/securite') router.replace('/dashboard/securite');
  }, [utilisateur, chemin, router]);
  return null;
}
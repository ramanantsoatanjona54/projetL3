'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // adaptez le nom exact exporté

// Tant que le mot de passe temporaire n'est pas changé, tout ramène à la page de changement
export function ForcerChangementMdp() {
  const { utilisateur } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (utilisateur?.doitChangerMotDePasse && pathname !== '/dashboard/mot-de-passe') {
      router.replace('/dashboard/mot-de-passe');
    }
  }, [utilisateur, pathname, router]);

  return null;
}
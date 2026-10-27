'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { EtatPage, LIEN_PRINCIPAL } from '@/components/EtatPage';

export function AccesRefuse({ message }: { message?: string }) {
  const { utilisateur } = useAuth();
  const accueil = utilisateur?.role === 'ENSEIGNANT' ? '/dashboard/enseignant' : utilisateur?.role === 'PARENT' ? '/dashboard/parent' : '/dashboard';
  return (
    <EtatPage code="403" titre="Accès non autorisé" actions={<Link href={accueil} className={LIEN_PRINCIPAL}>Retour à mon espace</Link>}>
      <p>{message ?? "Votre rôle ne donne pas accès à cette page. Si vous pensez qu'il s'agit d'une erreur, contactez l'administration."}</p>
    </EtatPage>
  );
}
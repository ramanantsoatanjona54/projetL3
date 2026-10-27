'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { EtatPage, LIEN_PRINCIPAL } from '@/components/EtatPage';

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Erreur affichée à l\'utilisateur', error.digest ?? ''); }, [error]); // jamais de détail technique à l'écran

  return (
    <EtatPage
      code="500" titre="Un problème est survenu"
      actions={
        <>
          <button type="button" onClick={reset} className={LIEN_PRINCIPAL}>Réessayer</button>
          <Link href="/dashboard" className="inline-flex h-11 items-center rounded-md border border-border px-5 text-base font-medium hover:bg-secondary">Retour à l&apos;accueil</Link>
        </>
      }
    >
      <p>Ce n&apos;est pas de votre faute. Réessayez, et si le problème continue, prévenez l&apos;administration en indiquant l&apos;heure.</p>
    </EtatPage>
  );
}
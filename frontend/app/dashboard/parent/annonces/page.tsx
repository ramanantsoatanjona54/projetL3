'use client';

import Link from 'next/link';
import { ListeAnnonces } from '@/components/annonces/ListeAnnonces';

export default function AnnoncesParent() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">Annonces de l&apos;école</h1>
      <p className="mb-6 text-sm text-muted-foreground">Les informations importantes de la vie de l&apos;école.</p>
      <ListeAnnonces peutGerer={false} parent />
    </div>
  );
}
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { ExamenDocument } from '@/lib/bulletin-types';
import { ExamenVue } from '@/components/bulletins/ExamenVue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function PageExamenEleve() {
  const { inscriptionId, numero } = useParams<{ inscriptionId: string; numero: string }>();
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);
  const [d, setD] = useState<ExamenDocument | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!autorise) return;
    api.get<ExamenDocument>(`/bulletins/${inscriptionId}/examen/${numero}`)
      .then((r) => { setD(r); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [autorise, inscriptionId, numero]);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe de l&apos;école.</AlertDescription></Alert>;
  }
  return (
    <div>
      <div className="no-print">
        <Link href="/dashboard/bulletins" className="text-sm underline underline-offset-4">← Retour aux bulletins</Link>
        <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Examen blanc n°{numero}</h1>
          <Button variant="outline" onClick={() => window.print()} disabled={!d}>Imprimer</Button>
        </div>
        {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
        <p className="mb-4 text-sm text-muted-foreground">Les notes se saisissent dans le menu « Examens blancs ». Ce document les reprend automatiquement.</p>
      </div>
      {d ? <ExamenVue d={d} /> : !erreur && <p className="text-muted-foreground">Chargement...</p>}
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { EdtParent } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GrilleEdt } from '@/components/emploi-du-temps/GrilleEdt';

export default function EmploiDuTempsEnfant() {
  const { inscriptionId } = useParams<{ inscriptionId: string }>();
  const [d, setD] = useState<EdtParent | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<EdtParent>(`/parent/inscriptions/${inscriptionId}/emploi-du-temps`).then(setD).catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId]);

  return (
    <div>
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
      {erreur && <Alert variant="destructive" role="alert" className="mt-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!d && !erreur && <p className="mt-4 text-muted-foreground">Chargement...</p>}
      {d && (
        <>
          <h1 className="mb-1 mt-2 text-3xl font-semibold">Emploi du temps de {d.eleve.prenom}</h1>
          <p className="mb-6 text-sm text-muted-foreground">Salle {d.salle.nom} · {d.salle.niveau}</p>
          <GrilleEdt creneaux={d.creneaux} />
        </>
      )}
    </div>
  );
}
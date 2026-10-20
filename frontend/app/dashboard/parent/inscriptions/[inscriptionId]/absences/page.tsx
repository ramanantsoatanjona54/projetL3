'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import type { AbsencesParent } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function AbsencesEnfant() {
  const { inscriptionId } = useParams<{ inscriptionId: string }>();
  const [d, setD] = useState<AbsencesParent | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<AbsencesParent>(`/parent/inscriptions/${inscriptionId}/absences`).then(setD).catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
      {erreur && <Alert variant="destructive" role="alert" className="mt-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!d && !erreur && <p className="mt-4 text-muted-foreground">Chargement...</p>}

      {d && (
        <>
          <h1 className="mb-1 mt-2 text-3xl font-semibold">Absences de {d.eleve.prenom} {d.eleve.nom}</h1>
          <p className="mb-6 text-sm text-muted-foreground">Salle {d.salle} · Année {d.anneeScolaire}</p>

          <dl className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">Absences</dt><dd className="text-3xl font-semibold tabular-nums">{d.total}</dd></div>
            <div className="rounded-lg border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">Justifiées</dt><dd className="text-3xl font-semibold tabular-nums">{d.justifiees}</dd></div>
            <div className="rounded-lg border border-border bg-card p-4"><dt className="text-sm text-muted-foreground">À justifier</dt><dd className="text-3xl font-semibold tabular-nums">{d.nonJustifiees}</dd></div>
          </dl>

          {d.nonJustifiees > 0 && (
            <Alert role="status" className="mb-6">
              <AlertDescription>Pour justifier une absence, présentez le motif au secrétariat de l&apos;école.</AlertDescription>
            </Alert>
          )}

          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {d.absences.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Aucune absence enregistrée cette année.</li>}
            {d.absences.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{dateFr(a.date)}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {a.motif && <span className="text-sm text-muted-foreground">{a.motif}</span>}
                  <Badge variant={a.justifiee ? 'secondary' : 'destructive'}>{a.justifiee ? 'Justifiée' : 'À justifier'}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
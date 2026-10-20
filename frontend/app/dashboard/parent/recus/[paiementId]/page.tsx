'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { ar, dateFr } from '@/lib/format';
import { nomMoisNumero } from '@/lib/parent';
import type { RecuParent } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2">
      <dt className="text-muted-foreground">{libelle}</dt>
      <dd className="text-right font-medium">{valeur}</dd>
    </div>
  );
}

export default function RecuParentPage() {
  const { paiementId } = useParams<{ paiementId: string }>();
  const [r, setR] = useState<RecuParent | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<RecuParent>(`/parent/paiements/${paiementId}/recu`).then(setR).catch((e) => setErreur(messageErreur(e)));
  }, [paiementId]);

  const objet = r
    ? `${r.typeFrais === 'ECOLAGE' ? 'Écolage' : (r.typeFrais ?? 'Frais')} — ${
        r.mode === 'GLOBAL_ANNUEL' ? `année scolaire ${r.anneeScolaire} (paiement annuel)` : `mois de ${nomMoisNumero(r.moisConcerne)}`
      }`
    : '';

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
        {r && <Button onClick={() => window.print()}>Imprimer ou enregistrer en PDF</Button>}
      </div>

      {erreur && <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!r && !erreur && <p className="text-muted-foreground">Chargement...</p>}

      {r && (
        <article className="rounded-lg border border-border bg-card p-6 print:border-0 print:p-0">
          <header className="mb-6 border-b-2 border-foreground pb-4">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Les Colibris</p>
            <h1 className="text-3xl font-semibold">Reçu de paiement</h1>
            <p className="text-lg">N° {r.numeroRecu ?? paiementId}</p>
          </header>

          <dl className="mb-6">
            <Ligne libelle="Date" valeur={r.dateEffective ? dateFr(r.dateEffective) : '—'} />
            <Ligne libelle="Élève" valeur={`${r.eleve.prenom} ${r.eleve.nom}`} />
            <Ligne libelle="Matricule" valeur={r.eleve.matricule} />
            <Ligne libelle="Classe" valeur={`Salle ${r.salle} · ${r.niveau}`} />
            <Ligne libelle="Année scolaire" valeur={r.anneeScolaire} />
            <Ligne libelle="Objet" valeur={objet} />
            <Ligne libelle="Montant" valeur={ar(r.montant)} />
            {r.montantPenalite > 0 && <Ligne libelle="Pénalité de retard" valeur={ar(r.montantPenalite)} />}
          </dl>

          <p className="flex justify-between text-xl font-semibold">
            <span>Total réglé</span>
            <span className="tabular-nums">{ar(r.montant + r.montantPenalite)}</span>
          </p>
          <p className="mt-6 text-sm text-muted-foreground">Document à conserver comme justificatif de paiement.</p>
        </article>
      )}
    </div>
  );
}
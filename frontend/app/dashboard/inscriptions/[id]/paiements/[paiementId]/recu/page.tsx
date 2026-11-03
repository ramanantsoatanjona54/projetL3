'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { ar, dateFr, nomMois } from '@/lib/format';
import type { Recu } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

function Ligne({ label, valeur }: { label: string; valeur: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-neutral-300 py-1.5">
      <dt className="w-44 shrink-0 text-neutral-600">{label}</dt>
      <dd className="font-medium">{valeur}</dd>
    </div>
  );
}

export default function RecuPaiement() {
  const { id, paiementId } = useParams<{ id: string; paiementId: string }>();
  const [r, setR] = useState<Recu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<Recu>(`/finances/paiements/${paiementId}/recu`)
      .then(setR)
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  }, [paiementId]);

  if (erreur) return <Alert variant="destructive"><AlertDescription>{erreur}</AlertDescription></Alert>;
  if (!r) return <p className="text-muted-foreground">Chargement...</p>;

  const total = Number(r.montant) + Number(r.montantPenalite);
  const { eleve } = r.inscription;

  return (
    <div>
      <div className="mb-4 flex gap-3 print:hidden">
        <Button onClick={() => window.print()}>Imprimer / Enregistrer en PDF</Button>
        <Button asChild variant="outline"><Link href={`/dashboard/inscriptions/${id}/paiements`}>Retour aux paiements</Link></Button>
      </div>

      <article className="relative mx-auto max-w-2xl bg-white p-10 text-base text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {r.statut === 'annule' && (
          <p className="absolute right-10 top-10 rotate-6 border-4 border-red-700 px-4 py-1 text-2xl font-bold uppercase text-red-700">Annulé</p>
        )}
        <header className="mb-6 border-b-2 border-black pb-4 text-center">
          <p className="font-heading text-2xl font-semibold">Les Colibris</p>
          <h1 className="font-heading mt-1 text-3xl font-semibold">Reçu de paiement</h1>
          <p className="mt-1 font-mono">{r.numeroRecu}</p>
        </header>

        <dl className="mb-6">
          <Ligne label="Date d'encaissement" valeur={dateFr(r.dateEffective)} />
          <Ligne label="Élève" valeur={`${eleve.nom.toUpperCase()} ${eleve.prenom} (${eleve.matricule})`} />
          <Ligne label="Niveau / salle" valeur={`${r.inscription.niveau.nom} · ${r.inscription.salle.nom}`} />
          <Ligne label="Année scolaire" valeur={r.inscription.anneeScolaire.libelle} />
          <Ligne label="Objet" valeur={r.mode === 'GLOBAL_ANNUEL' ? 'Écolage : année entière' : `Écolage : ${nomMois(r.datePrevue)}`} />
        </dl>

        <table className="mb-8 w-full border-collapse text-left">
          <tbody>
            <tr className="border-b border-neutral-300"><td className="py-1.5">Écolage</td><td className="text-right">{ar(r.montant)}</td></tr>
            {Number(r.montantPenalite) > 0 && (
              <tr className="border-b border-neutral-300"><td className="py-1.5">Pénalité de retard</td><td className="text-right">{ar(r.montantPenalite)}</td></tr>
            )}
            <tr className="border-t-2 border-black text-lg font-semibold"><td className="py-2">Total reçu</td><td className="text-right">{ar(total)}</td></tr>
          </tbody>
        </table>

        {r.statut === 'annule' && r.motifAnnulation && (
          <p className="mb-6 text-sm text-neutral-700">Motif d&apos;annulation : {r.motifAnnulation}</p>
        )}

        <footer className="pt-6">
          <p className="mb-14 border-b border-black pb-1">Cachet et signature de la comptabilité</p>
        </footer>
      </article>
    </div>
  );
}
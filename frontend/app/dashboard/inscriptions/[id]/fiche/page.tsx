'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { InscriptionFiche } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const fr = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const ar = (v: unknown) => `${new Intl.NumberFormat('fr-FR').format(Number(v))} Ar`;
const LIENS: Record<string, string> = { pere: 'Père', mere: 'Mère', tuteur: 'Tuteur' };
const STATUTS: Record<string, string> = { en_attente: 'En attente de validation', validee: 'Validée', annulee: 'Annulée' };

function Ligne({ label, valeur }: { label: string; valeur: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b border-neutral-300 py-1.5">
      <dt className="w-44 shrink-0 text-neutral-600">{label}</dt>
      <dd className="font-medium">{valeur || '—'}</dd>
    </div>
  );
}

export default function FicheInscription() {
  const { id } = useParams<{ id: string }>();
  const [fiche, setFiche] = useState<InscriptionFiche | null>(null);
  const [montant, setMontant] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<InscriptionFiche>(`/inscriptions/${id}/fiche`)
      .then(async (f) => {
        setFiche(f);
        const m = await api.get<string | number | undefined>(`/finances/montant-ecolage/${f.rangFratrie}`).catch(() => undefined);
        if (m !== undefined && m !== null) setMontant(String(m));
      })
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  }, [id]);

  if (erreur) return <Alert variant="destructive"><AlertDescription>{erreur}</AlertDescription></Alert>;
  if (!fiche) return <p className="text-muted-foreground">Chargement...</p>;

  const { eleve } = fiche;

  return (
    <div>
      <div className="mb-4 flex gap-3 print:hidden">
        <Button onClick={() => window.print()}>Imprimer / Enregistrer en PDF</Button>
        <Button asChild variant="outline"><Link href={`/dashboard/eleves/${eleve.id}`}>Retour à la fiche</Link></Button>
      </div>

      {/* Document : toujours noir sur blanc, même en mode sombre */}
      <article className="mx-auto max-w-3xl bg-white p-10 text-base text-black shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-6 border-b-2 border-black pb-4 text-center">
          <p className="font-heading text-2xl font-semibold">Les Colibris</p>
          <h1 className="font-heading mt-1 text-3xl font-semibold">Fiche d&apos;inscription</h1>
          <p className="mt-1">Année scolaire {fiche.anneeScolaire?.libelle}</p>
          <p className="mt-2 inline-block border border-black px-3 py-0.5 text-sm uppercase tracking-wide">
            {STATUTS[fiche.statut] ?? fiche.statut}
          </p>
        </header>

        <section className="mb-6">
          <h2 className="font-heading mb-2 text-xl font-semibold">Élève</h2>
          <dl>
            <Ligne label="Nom et prénom" valeur={`${eleve.nom.toUpperCase()} ${eleve.prenom}`} />
            <Ligne label="Matricule" valeur={eleve.matricule} />
            <Ligne label="N° d'inscription (dossier)" valeur={eleve.numeroInscription} />
            <Ligne label="Sexe" valeur={eleve.sexe === 'F' ? 'Féminin' : 'Masculin'} />
            <Ligne label="Date de naissance" valeur={fr(eleve.dateNaissance)} />
            <Ligne label="Quartier" valeur={eleve.quartier} />
          </dl>
        </section>

        <section className="mb-6">
          <h2 className="font-heading mb-2 text-xl font-semibold">Scolarité</h2>
          <dl>
            <Ligne label="Niveau" valeur={fiche.niveau?.nom} />
            <Ligne label="Salle" valeur={fiche.salle?.nom} />
            <Ligne label="Rang dans la fratrie" valeur={fiche.rangFratrie === 1 ? '1er enfant' : `${fiche.rangFratrie}e enfant`} />
            {montant !== null && <Ligne label="Écolage applicable" valeur={ar(montant)} />}
            <Ligne label="Date d'inscription" valeur={fr(fiche.dateInscription)} />
          </dl>
        </section>

        <section className="mb-10">
          <h2 className="font-heading mb-2 text-xl font-semibold">Parents et tuteurs</h2>
          {eleve.parents?.length ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="py-1.5">Nom</th><th>Lien</th><th>Téléphone</th>
                </tr>
              </thead>
              <tbody>
                {eleve.parents.map((p) => (
                  <tr key={p.parentId} className="border-b border-neutral-300">
                    <td className="py-1.5">{p.parent.nom.toUpperCase()} {p.parent.prenom}</td>
                    <td>{LIENS[p.lienParente] ?? p.lienParente}</td>
                    <td>{p.parent.telephone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Aucun parent renseigné.</p>
          )}
        </section>

        <footer className="grid grid-cols-2 gap-10 pt-6">
          <div>
            <p className="mb-14 border-b border-black pb-1">Signature du parent ou tuteur</p>
            <p className="text-sm text-neutral-600">Date : ____ / ____ / ________</p>
          </div>
          <div>
            <p className="mb-14 border-b border-black pb-1">Cachet et signature du secrétariat</p>
            <p className="text-sm text-neutral-600">Date : ____ / ____ / ________</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
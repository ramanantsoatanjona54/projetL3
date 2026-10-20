'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { ar, dateFr, nomMois } from '@/lib/format';
import { libelleEcheance, libelleMode, nomMoisNumero, varianteEcheance } from '@/lib/parent';
import type { SituationParent } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function Chiffre({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{libelle}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{valeur}</dd>
      {detail && <dd className="text-sm text-muted-foreground">{detail}</dd>}
    </div>
  );
}

export default function SituationEnfant() {
  const { inscriptionId } = useParams<{ inscriptionId: string }>();
  const [s, setS] = useState<SituationParent | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<SituationParent>(`/parent/inscriptions/${inscriptionId}/situation`)
      .then(setS)
      .catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>

      {erreur && <Alert variant="destructive" role="alert" className="mt-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!s && !erreur && <p className="mt-4 text-muted-foreground">Chargement...</p>}

      {s && (
        <>
          <h1 className="mb-1 mt-2 text-3xl font-semibold">{s.inscription.eleve.prenom} {s.inscription.eleve.nom}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Salle {s.inscription.salle.nom} · {s.inscription.niveau.nom} · Année {s.inscription.anneeScolaire.libelle}
          </p>

          {s.annuelPaye && (
            <Alert role="status" className="mb-6"><AlertDescription>L&apos;année est entièrement réglée. Merci !</AlertDescription></Alert>
          )}

          <dl className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Chiffre libelle="Écolage mensuel" valeur={ar(s.montantMensuel)} detail={s.inscription.rangFratrie > 1 ? `Tarif fratrie (enfant n°${s.inscription.rangFratrie})` : undefined} />
            <Chiffre libelle="Total payé" valeur={ar(s.totalPaye)} detail={`sur ${ar(s.totalAnnuel)}`} />
            <Chiffre libelle="Reste à payer sur l'année" valeur={ar(s.resteAPayer)} />
            <Chiffre libelle="Pénalités de retard" valeur={ar(s.penalitesEnCours)} />
          </dl>

          <h2 className="mb-3 text-xl font-semibold">Échéancier</h2>
          <div className="mb-8 overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead><TableHead>À payer avant le</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Pénalité</TableHead><TableHead>Situation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.echeances.map((e) => (
                  <TableRow key={e.mois}>
                    <TableCell className="font-medium capitalize">{nomMois(e.datePrevue)}</TableCell>
                    <TableCell>{dateFr(e.limite)}</TableCell>
                    <TableCell className="text-right tabular-nums">{ar(e.montant)}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.penalite > 0 ? ar(e.penalite) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={varianteEcheance[e.statut]}>{libelleEcheance[e.statut]}</Badge>
                      {e.statut === 'en_retard' && <span className="block text-sm text-muted-foreground">{e.joursRetard} jour(s) de retard</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <h2 className="mb-3 text-xl font-semibold">Paiements enregistrés</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reçu</TableHead><TableHead>Date</TableHead><TableHead>Objet</TableHead>
                  <TableHead className="text-right">Montant</TableHead><TableHead className="text-right">Reçu imprimable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.paiements.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucun paiement enregistré pour le moment.</TableCell></TableRow>
                ) : s.paiements.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.numeroRecu ?? `n°${p.id}`}</TableCell>
                    <TableCell>{p.dateEffective ? dateFr(p.dateEffective) : '—'}</TableCell>
                    <TableCell>
                      {libelleMode(p.mode)}
                      {p.moisConcerne && <span className="block text-sm capitalize text-muted-foreground">{nomMoisNumero(p.moisConcerne)}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ar(p.montant + p.montantPenalite)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/parent/recus/${p.id}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        aria-label={`Ouvrir le reçu ${p.numeroRecu ?? p.id}`}
                      >
                        Voir le reçu
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
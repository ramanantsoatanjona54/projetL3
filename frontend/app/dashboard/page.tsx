'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { ar, dateFr } from '@/lib/format';
import { dateHeure, libelleAction } from '@/lib/audit';
import { nomMoisNumero } from '@/lib/parent';
import { aujourdhuiIso, libelleJour } from '@/lib/pointage';
import type { TableauDeBord } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const LIBELLES_ROLE: Record<string, string> = {
  ADMIN: 'Administrateur', ENSEIGNANT: 'Enseignant', SECRETARIAT: 'Secrétariat',
  COMPTABLE: 'Comptable', DIRECTRICE: 'Directrice', PARENT: 'Parent',
};

function Tuile({ href, libelle, valeur, detail, alerte }: {
  href?: string; libelle: string; valeur: string; detail?: string; alerte?: boolean;
}) {
  const contenu = (
    <>
      <p className="text-sm text-muted-foreground">{libelle}</p>
      <p className="text-3xl font-semibold tabular-nums">{valeur}</p>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
    </>
  );
  const base = `block rounded-lg border bg-card p-4 ${alerte ? 'border-destructive' : 'border-border'}`;
  return href ? (
    <Link href={href} className={`${base} transition-colors hover:border-primary`}>{contenu}</Link>
  ) : (
    <div className={base}>{contenu}</div>
  );
}

function Section({ titre, lien, children }: { titre: string; lien?: { href: string; libelle: string }; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{titre}</h2>
        {lien && <Link href={lien.href} className="text-sm underline hover:text-primary">{lien.libelle}</Link>}
      </div>
      {children}
    </section>
  );
}

export default function Accueil() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const [d, setD] = useState<TableauDeBord | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!role || role === 'PARENT') return;
    api.get<TableauDeBord>('/tableau-de-bord').then(setD).catch((e) => setErreur(messageErreur(e)));
  }, [role]);

  if (!role || role === 'PARENT') return null; // le parent est redirigé vers son espace

  const maxSalle = Math.max(1, ...(d?.eleves?.parSalle.map((s) => s.effectif) ?? [1]));

  return (
    <div>
      <p className="text-sm capitalize text-muted-foreground">{libelleJour(aujourdhuiIso())}</p>
      <h1 className="mb-1 text-3xl font-semibold">Tableau de bord</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {LIBELLES_ROLE[role] ?? role}
        {d?.anneeScolaire ? ` · Année scolaire ${d.anneeScolaire.libelle}` : ' · Aucune année scolaire en cours'}
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!d && !erreur && <p className="text-muted-foreground">Chargement...</p>}

      {role === 'ENSEIGNANT' && (
        <Alert role="status">
          <AlertDescription>
            Votre espace pédagogique (classes, évaluations, emploi du temps) sera disponible prochainement.
          </AlertDescription>
        </Alert>
      )}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.eleves && (
              <>
                <Tuile href="/dashboard/eleves" libelle="Élèves inscrits" valeur={String(d.eleves.effectif)} detail="Inscriptions validées de l'année" />
                <Tuile
                  href="/dashboard/inscriptions" libelle="Inscriptions en attente" valeur={String(d.eleves.enAttente)}
                  detail={d.eleves.enAttente > 0 ? 'À valider par le secrétariat' : 'Rien à valider'}
                />
              </>
            )}
            {d.finances && (
              <>
                <Tuile libelle="Encaissé ce mois" valeur={ar(d.finances.encaisseMois)} detail={`${d.finances.nbPaiementsMois} paiement(s)`} />
                <Tuile
                  href="/dashboard/finances/retards" libelle="Retards de paiement" valeur={String(d.finances.retards.nombre)}
                  detail={d.finances.retards.nombre > 0 ? `${ar(d.finances.retards.montantDu + d.finances.retards.penalites)} à recouvrer` : 'Aucun retard'}
                  alerte={d.finances.retards.nombre > 0}
                />
              </>
            )}
            {d.personnel && (
              <Tuile
                href="/dashboard/pointage" libelle="Personnel présent"
                valeur={`${d.personnel.presentsAujourdhui} / ${d.personnel.enPoste}`}
                detail={d.personnel.jourOuvre ? "Aujourd'hui" : "Jour non travaillé"}
              />
            )}
            {d.comptes && (
              <Tuile
                href="/dashboard/utilisateurs" libelle="Comptes actifs" valeur={String(d.comptes.actifs)}
                detail={`${d.comptes.verrouilles} verrouillé(s) · ${d.comptes.motDePasseTemporaire} mot(s) de passe temporaire(s)`}
                alerte={d.comptes.verrouilles > 0}
              />
            )}
          </div>

          {role === 'SECRETARIAT' && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/eleves/nouveau" className={buttonVariants({ size: 'lg' })}>Nouvel élève</Link>
              <Link href="/dashboard/inscriptions" className={buttonVariants({ size: 'lg', variant: 'outline' })}>File des inscriptions</Link>
            </div>
          )}

          {d.eleves && d.eleves.attente.length > 0 && (
            <Section titre="Inscriptions à valider" lien={{ href: '/dashboard/inscriptions', libelle: 'Tout voir' }}>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {d.eleves.attente.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="font-medium">{i.eleve}</span>
                    <span className="text-sm text-muted-foreground">Salle {i.salle} · demandée le {dateFr(i.dateInscription)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {d.eleves && d.eleves.parSalle.length > 0 && (
            <Section titre="Répartition par salle">
              <ul className="space-y-2 rounded-lg border border-border bg-card p-4">
                {d.eleves.parSalle.map((s) => (
                  <li key={s.salle} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3">
                    <span className="font-medium">{s.salle}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full bg-primary" style={{ width: `${(s.effectif / maxSalle) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums">{s.effectif}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {d.finances && d.finances.retards.plusGros.length > 0 && (
            <Section titre="Plus gros retards" lien={{ href: '/dashboard/finances/retards', libelle: 'Liste complète' }}>
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead><TableHead>Salle</TableHead><TableHead>Mois</TableHead>
                      <TableHead className="text-right">Dû</TableHead><TableHead className="text-right">Pénalités</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.finances.retards.plusGros.map((l) => (
                      <TableRow key={l.inscriptionId}>
                        <TableCell>
                          <Link href={`/dashboard/inscriptions/${l.inscriptionId}/paiements`} className="font-medium underline hover:text-primary">{l.eleve}</Link>
                        </TableCell>
                        <TableCell>{l.salle}</TableCell>
                        <TableCell className="capitalize">{l.moisEnRetard.map(nomMoisNumero).join(', ')}</TableCell>
                        <TableCell className="text-right tabular-nums">{ar(l.montantDu)}</TableCell>
                        <TableCell className="text-right tabular-nums">{ar(l.penalites)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Section>
          )}

          {d.finances?.derniersPaiements && (
            <Section titre="Derniers paiements">
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {d.finances.derniersPaiements.length === 0 && <li className="px-4 py-6 text-center text-muted-foreground">Aucun paiement enregistré.</li>}
                {d.finances.derniersPaiements.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span>
                      <Link href={`/dashboard/inscriptions/${p.inscriptionId}/paiements/${p.id}/recu`} className="font-medium underline hover:text-primary">
                        {p.numeroRecu ?? `n°${p.id}`}
                      </Link>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {p.eleve} · {p.mode === 'GLOBAL_ANNUEL' ? 'annuel' : nomMoisNumero(p.moisConcerne)}
                      </span>
                    </span>
                    <span className="tabular-nums">{ar(p.total)}{p.dateEffective ? ` · ${dateFr(p.dateEffective)}` : ''}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {d.activiteRecente && (
            <Section titre="Activité récente" lien={{ href: '/dashboard/audit', libelle: "Journal d'audit complet" }}>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {d.activiteRecente.length === 0 && <li className="px-4 py-6 text-center text-muted-foreground">Aucune activité enregistrée.</li>}
                {d.activiteRecente.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span>
                      <span className="font-medium">{libelleAction(l.action)}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {l.utilisateur?.email ?? 'Système'}{l.entite ? ` · ${l.entite}${l.entiteId ? ` n°${l.entiteId}` : ''}` : ''}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">{l.date ? dateHeure(l.date) : ''}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
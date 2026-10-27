'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { dateFr } from '@/lib/format';
import { messageErreur } from '@/lib/messages';
import { useActualisationAuto } from '@/lib/useActualisationAuto';
import type { AccueilEnseignant } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';

const heure = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Antananarivo' });

function Barre({ valeur, total, nom }: { valeur: number; total: number; nom: string }) {
  const pct = total > 0 ? Math.round((valeur * 100) / total) : 0;
  return (
    <div>
      <div role="progressbar" aria-label={nom} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">{valeur} / {total} ({pct} %)</p>
    </div>
  );
}

export default function EspaceEnseignant() {
  const { utilisateur } = useAuth();
  const [d, setD] = useState<AccueilEnseignant | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const autorise = utilisateur?.role === 'ENSEIGNANT';

  const charger = useCallback(() => {
    if (!autorise) return;
    api.get<AccueilEnseignant>('/enseignant/accueil').then((r) => { setD(r); setErreur(null); }).catch((e) => setErreur(messageErreur(e)));
  }, [autorise]);
  useEffect(() => { charger(); }, [charger]);
  useActualisationAuto(charger);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cet espace est réservé aux enseignants.</AlertDescription></Alert>;
  }
  if (erreur) return <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>;
  if (!d) return <p className="text-muted-foreground">Chargement...</p>;

  const jourTexte = new Date(`${d.aujourdhui}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  if (!d.salle) {
    return (
      <div>
        <h1 className="mb-2 text-3xl font-semibold">Bonjour {d.enseignant.prenom}</h1>
        <Alert role="status"><AlertDescription>Aucune salle ne vous est affectée pour le moment. Contactez l&apos;administration pour qu&apos;elle vous en attribue une.</AlertDescription></Alert>
      </div>
    );
  }

    const examensIncomplets = (d.examens ?? []).filter((e) => e.passe && e.saisies < e.attendues);
  const aFaire: { cle: string; texte: string; href: string }[] = examensIncomplets.map((e) => ({
    cle: `ex${e.id}`,
    texte: `Examen blanc n°${e.numero} : ${e.attendues - e.saisies} note(s) manquante(s)`,
    href: `/dashboard/examens-blancs/${e.id}`,
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm capitalize text-muted-foreground">{jourTexte}</p>
        <h1 className="text-3xl font-semibold">Bonjour {d.enseignant.prenom}</h1>
        <p className="text-muted-foreground">Salle {d.salle.nom} · {d.salle.effectif} élève(s)</p>
      </div>

      <section aria-labelledby="afaire">
        <h2 id="afaire" className="mb-2 text-xl font-semibold">À faire</h2>
        {aFaire.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-4 text-muted-foreground">Rien d&apos;urgent. Tout est à jour.</p>
        ) : (
          <ul className="space-y-2">
            {aFaire.map((a) => (
              <li key={a.cle} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                <span>{a.texte}</span>
                <Link href={a.href} className={buttonVariants({ variant: 'outline' })}>Ouvrir</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6">
        <section aria-labelledby="journee" className="rounded-lg border border-border bg-card p-4">
          <h2 id="journee" className="mb-2 text-xl font-semibold">Aujourd&apos;hui</h2>
          {!d.jourOuvre ? (
            <p className="text-muted-foreground">Pas de cours aujourd&apos;hui.</p>
          ) : (
            <>
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Emploi du temps</h3>
              {(d.cours ?? []).length === 0 ? <p className="mb-3 text-sm text-muted-foreground">Aucun créneau enregistré.</p> : (
                <ul className="mb-3 divide-y divide-border text-sm">
                  {(d.cours ?? []).map((c, i) => (
                    <li key={i} className="flex justify-between gap-3 py-1.5">
                      <span className="tabular-nums">{c.debut} – {c.fin}</span>
                      <span className="text-right">{c.libelle} <span className="text-muted-foreground">· {c.niveau}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Absents</h3>
              {(d.absentsAujourdhui ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucune absence enregistrée.</p> : (
                <ul className="flex flex-wrap gap-2">
                  {(d.absentsAujourdhui ?? []).map((a, i) => (
                    <li key={i}><Badge variant={a.justifiee ? 'outline' : 'secondary'}>{a.prenom} {a.nom}{a.justifiee ? ' · justifiée' : ''}</Badge></li>
                  ))}
                </ul>
              )}
              <Link href="/dashboard/absences" className={`${buttonVariants({ variant: 'outline' })} mt-3`}>Faire l&apos;appel</Link>
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="avancement">
        <h2 id="avancement" className="mb-2 text-xl font-semibold">Avancement pédagogique</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {d.salle.niveaux.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 font-semibold">{n.nom} <span className="font-normal text-muted-foreground">· {n.effectif} élève(s)</span></h3>
              {n.avancement.length === 0 && <p className="text-sm text-muted-foreground">Référentiel non chargé pour ce niveau.</p>}
              {n.avancement.map((a) => (
                <div key={a.semestre} className="mb-4 space-y-2 last:mb-0">
                  <p className="text-sm font-medium">Semestre {a.semestre}</p>
                  <div><p className="text-xs text-muted-foreground">Évaluations saisies</p><Barre nom={`Évaluations ${n.nom} semestre ${a.semestre}`} valeur={a.saisies} total={a.attendues} /></div>
                  <div><p className="text-xs text-muted-foreground">{n.type === 'domaines' ? 'Domaines terminés' : 'Leçons vues en classe'}</p><Barre nom={`Suivi ${n.nom} semestre ${a.semestre}`} valeur={a.suivi} total={a.suiviTotal} /></div>
                  <div><p className="text-xs text-muted-foreground">Appréciations de bulletin rédigées</p><Barre nom={`Bulletins ${n.nom} semestre ${a.semestre}`} valeur={a.bulletinsRediges} total={a.effectif} /></div>
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/dashboard/evaluations" className={buttonVariants({ variant: 'outline' })}>Évaluations</Link>
                <Link href="/dashboard/bulletins" className={buttonVariants({ variant: 'outline' })}>Bulletins</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(d.examens ?? []).length > 0 && (
        <section aria-labelledby="examens">
          <h2 id="examens" className="mb-2 text-xl font-semibold">Examens blancs</h2>
          <ul className="space-y-2">
            {(d.examens ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="font-medium">Examen n°{e.numero} · {dateFr(e.date)}</p>
                  <p className="text-sm text-muted-foreground">{e.passe ? `${e.saisies} / ${e.attendues} notes saisies` : "Pas encore passé : la saisie ouvre à la date de l'examen"}</p>
                </div>
                <Link href={`/dashboard/examens-blancs/${e.id}`} className={buttonVariants({ variant: 'outline' })}>Ouvrir</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
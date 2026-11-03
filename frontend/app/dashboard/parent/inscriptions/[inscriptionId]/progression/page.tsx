'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Niveau = 'A' | 'EA' | 'AR' | null;
interface Item { libelle: string; niveau: Niveau }
interface Section { titre: string | null; items: Item[] }
interface Groupe { titre: string; sections: Section[] }
interface Ceinture { nom: string; groupes: Groupe[] }
interface Progression {
  eleve: { nom: string; prenom: string };
  salle: string; niveau: string; annee: string; semestre: number;
  type: 'domaines' | 'lecons';
  ceintures: Ceinture[];
  resume: { A: number; EA: number; AR: number; nonEvalue: number };
}

const LIBELLE: Record<'A' | 'EA' | 'AR', string> = { A: 'Acquis', EA: 'En cours d’acquisition', AR: 'À renforcer' };
const VARIANTE: Record<'A' | 'EA' | 'AR', 'default' | 'secondary' | 'outline'> = { A: 'default', EA: 'secondary', AR: 'outline' };

function Tuile({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{libelle}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{valeur}</dd>
    </div>
  );
}

// Progression de l'enfant : lecture seule, aucune action de modification
export default function ProgressionEnfant() {
  const { inscriptionId } = useParams<{ inscriptionId: string }>();
  const [semestre, setSemestre] = useState('1');
  const [d, setD] = useState<Progression | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setD(null); setErreur(null);
    api.get<Progression>(`/parent/inscriptions/${inscriptionId}/bulletins/progression/${semestre}`)
      .then(setD)
      .catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId, semestre]);

  const evalues = d ? d.resume.A + d.resume.EA + d.resume.AR : 0;
  const total = d ? evalues + d.resume.nonEvalue : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">Progression{d ? ` de ${d.eleve.prenom}` : ''}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {d ? `Salle ${d.salle} · ${d.niveau} · Année ${d.annee}. ` : ''}
        Les évaluations sont mises à jour par l&apos;enseignant au fil de l&apos;année. Cette page est en lecture seule.
      </p>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Semestre">
        {['1', '2'].map((s) => (
          <Button key={s} variant={semestre === s ? 'default' : 'outline'} aria-pressed={semestre === s} onClick={() => setSemestre(s)}>
            Semestre {s}
          </Button>
        ))}
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!d && !erreur && <p className="text-muted-foreground">Chargement...</p>}

      {d && (
        <>
          <p className="mb-3 text-base" aria-live="polite">
            <strong>{evalues}</strong> évaluation(s) saisie(s) sur {total}.
          </p>
          <dl className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tuile libelle="Acquis" valeur={d.resume.A} />
            <Tuile libelle="En cours d’acquisition" valeur={d.resume.EA} />
            <Tuile libelle="À renforcer" valeur={d.resume.AR} />
            <Tuile libelle="Pas encore évalué" valeur={d.resume.nonEvalue} />
          </dl>

          {d.ceintures.length === 0 && (
            <Alert role="status"><AlertDescription>Aucune évaluation n&apos;est encore disponible pour ce semestre.</AlertDescription></Alert>
          )}

          <div className="space-y-4">
            {d.ceintures.map((c, i) => (
              <details key={c.nom} open={i === 0} className="rounded-lg border border-border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-xl font-semibold">{c.nom}</summary>
                <div className="space-y-5 border-t border-border px-4 py-4">
                  {c.groupes.map((g) => (
                    <section key={g.titre} aria-label={g.titre}>
                      <h2 className="mb-2 text-lg font-semibold">{g.titre}</h2>
                      {g.sections.map((s, k) => (
                        <div key={`${g.titre}-${s.titre ?? k}`} className="mb-3">
                          {s.titre && <h3 className="mb-1 text-sm font-medium text-muted-foreground">{s.titre}</h3>}
                          <ul className="divide-y divide-border rounded-md border border-border">
                            {s.items.map((it, n) => (
                              <li key={n} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                <span>{it.libelle}</span>
                                {it.niveau
                                  ? <Badge variant={VARIANTE[it.niveau]}>{LIBELLE[it.niveau]}</Badge>
                                  : <span className="text-sm text-muted-foreground">Pas encore évalué</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
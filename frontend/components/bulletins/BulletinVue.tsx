import { dateFr } from '@/lib/format';
import { LIBELLES_NIVEAU, ORDRE_NIVEAUX } from '@/lib/bulletin-types';
import type { BulletinDetail, NiveauBulletin } from '@/lib/bulletin-types';

const lettre = (i: number) => String.fromCharCode(65 + (i % 26)).repeat(Math.floor(i / 26) + 1);

// Le sens est porté par le texte (A, EA, AR, NA + mot entier), jamais par la couleur seule : lisible en noir et blanc
function Pastille({ n }: { n: NiveauBulletin | null }) {
  if (!n) return <span className="shrink-0 rounded border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">Non évalué</span>;
  const style = n === 'A' ? 'border-primary bg-primary text-primary-foreground' : n === 'EA' ? 'border-primary bg-primary/10' : n === 'AR' ? 'border-foreground font-bold' : 'border-foreground bg-foreground text-background';
  return <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>{n} · {LIBELLES_NIVEAU[n]}</span>;
}

interface Props {
  b: BulletinDetail;
  // Fourni = l'enseignante peut cliquer ; absent = lecture seule (Direction, parents, impression)
  onChoisir?: (elementId: number, niveau: NiveauBulletin | null) => void;
  desactive?: boolean;
}

function Choix({ id, libelle, valeur, onChoisir, desactive }: { id: number; libelle: string; valeur: NiveauBulletin | null; onChoisir: NonNullable<Props['onChoisir']>; desactive?: boolean }) {
  const options: (NiveauBulletin | null)[] = [...ORDRE_NIVEAUX, null];
  return (
    <div role="radiogroup" aria-label={`Évaluation : ${libelle}`} className="flex shrink-0 flex-wrap gap-1 print:hidden">
      {options.map((o) => {
        const actif = valeur === o;
        return (
          <button
            key={o ?? 'aucun'} type="button" role="radio" aria-checked={actif} disabled={desactive}
            title={o ? LIBELLES_NIVEAU[o] : 'Effacer'}
            onClick={() => onChoisir(id, actif ? null : o)}
            className={`min-h-9 min-w-9 rounded border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${actif ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}
          >
            {o ?? '—'}
            <span className="sr-only">{o ? ` ${LIBELLES_NIVEAU[o]}` : ' non évalué'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function BulletinVue({ b, onChoisir, desactive }: Props) {
  return (
    <article className="bulletin rounded-lg border border-border bg-card p-5 print:border-0 print:p-0">
      <div className="mb-4 flex items-center gap-4 border-b border-border pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-16 w-auto shrink-0" />
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Les Colibris · année {b.annee}</p>
          <h2 className="text-2xl font-semibold">Bulletin du semestre {b.semestre}</h2>
          <p className="mt-1 text-lg">{b.eleve.prenom} {b.eleve.nom}</p>
          <p className="text-sm text-muted-foreground">
            Né(e) le {dateFr(b.eleve.dateNaissance)} · matricule {b.eleve.matricule} · {b.niveau} · salle {b.salle}
          </p>
        </div>
      </div>

      <dl className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Légende">
        {ORDRE_NIVEAUX.map((n) => (<div key={n} className="flex gap-1"><dt className="font-semibold text-foreground">{n}</dt><dd>{LIBELLES_NIVEAU[n]}</dd></div>))}
      </dl>

      <p className="mb-4 text-sm" aria-label="Résumé des évaluations">
        <strong>{b.resume.A}</strong> acquis · <strong>{b.resume.EA}</strong> en cours d&apos;acquisition ·{' '}
        <strong>{b.resume.AR}</strong> à renforcer · <strong>{b.resume.NA}</strong> non acquis · <strong>{b.resume.nonEvalue}</strong> non évalué(s)
      </p>

      {b.disciplines.length === 0 && <p className="text-muted-foreground">Aucun contenu pour ce semestre.</p>}
      {b.disciplines.map((d, i) => (
        <section key={d.id} className="mb-5 break-inside-avoid" aria-label={d.titre}>
          <h3 className="mb-2 border-b border-border pb-1 text-lg font-semibold text-primary">{lettre(i)}. {d.titre}</h3>
          {d.rubriques.map((r, k) => (
            <div key={r.id ?? `direct-${k}`} className="mb-2">
              {r.titre && <h4 className="mb-1 text-sm font-semibold">{r.titre}</h4>}
              <ul className="divide-y divide-border">
                {r.lignes.map((l, n) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span><span className="mr-2 tabular-nums text-muted-foreground">{n + 1}.</span>{l.libelle}{l.archive && <span className="ml-2 text-xs text-muted-foreground">(ligne retirée)</span>}</span>
                    {onChoisir && !l.archive && <Choix id={l.id} libelle={l.libelle} valeur={l.niveau} onChoisir={onChoisir} desactive={desactive} />}
                    <span className={onChoisir && !l.archive ? 'hidden print:inline' : ''}><Pastille n={l.niveau} /></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <section className="break-inside-avoid">
        <h3 className="mb-1 text-lg font-semibold">Appréciation générale</h3>
        <p className="whitespace-pre-wrap rounded-md border border-border p-3 text-sm">
          {b.appreciation || <span className="text-muted-foreground">Pas encore rédigée.</span>}
        </p>
      </section>

      <div className="mt-8 hidden grid-cols-3 gap-6 text-center text-sm print:grid">
        {['L’enseignant(e)', 'La Direction', 'Les parents'].map((t) => (
          <div key={t}><div className="mb-10">{t}</div><div className="border-t border-foreground" /></div>
        ))}
      </div>
    </article>
  );
}
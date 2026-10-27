import { dateFr } from '@/lib/format';
import type { Bulletin, NiveauAcquis } from '@/lib/types';

const LIBELLES: Record<NiveauAcquis, string> = { A: 'Acquis', EA: "En cours d'acquisition", AR: 'À renforcer' };

// Le sens est porté par le texte (A, EA, AR + mot entier), jamais par la couleur seule : lisible en noir et blanc
function Pastille({ n }: { n: NiveauAcquis | null }) {
  if (!n) return <span className="shrink-0 rounded border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">Non évalué</span>;
  const style = n === 'A' ? 'border-primary bg-primary text-primary-foreground' : n === 'EA' ? 'border-primary bg-primary/10' : 'border-foreground font-bold';
  return <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${style}`}>{n} · {LIBELLES[n]}</span>;
}

export function BulletinVue({ b }: { b: Bulletin }) {
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

      <p className="mb-4 text-sm" aria-label="Résumé des évaluations">
        <strong>{b.resume.A}</strong> acquis · <strong>{b.resume.EA}</strong> en cours d&apos;acquisition ·{' '}
        <strong>{b.resume.AR}</strong> à renforcer · <strong>{b.resume.nonEvalue}</strong> non évalué(s)
      </p>

      {b.ceintures.length === 0 && <p className="text-muted-foreground">Aucun contenu pour ce semestre.</p>}
      {b.ceintures.map((c) => (
        <section key={c.nom} className="mb-6">
          <h3 className="mb-2 text-lg font-semibold">Ceinture {c.nom}</h3>
          {c.groupes.map((g) => (
            <div key={g.titre} className="mb-3 break-inside-avoid">
              <h4 className="mb-1 font-semibold text-primary">{g.titre}</h4>
              {g.sections.map((s, i) => (
                <div key={i} className="mb-2">
                  {s.titre && <h5 className="mb-1 text-sm font-medium text-muted-foreground">{s.titre}</h5>}
                  <ul className="divide-y divide-border">
                    {s.items.map((it, j) => (
                      <li key={j} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                        <span>{it.libelle}</span>
                        <Pastille n={it.niveau} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}

      {b.examens && b.examens.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h3 className="mb-2 text-lg font-semibold">Examens blancs (notes sur 20)</h3>
          {b.examens.map((e) => (
            <div key={e.numero} className="mb-3 overflow-x-auto">
              <p className="mb-1 text-sm font-medium">Examen n°{e.numero} · {dateFr(e.date)}</p>
              <table className="w-full min-w-80 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-1 pr-2 font-medium">Discipline</th>
                    <th className="px-2 py-1 text-center font-medium">Coef.</th>
                    <th className="px-2 py-1 text-center font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {e.notes.map((n) => (
                    <tr key={n.discipline} className="border-b border-border">
                      <td className="py-1 pr-2">{n.discipline}</td>
                      <td className="px-2 py-1 text-center tabular-nums">{n.coefficient}</td>
                      <td className="px-2 py-1 text-center tabular-nums">{n.note ?? '—'}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1 pr-2" colSpan={2}>Moyenne pondérée</td>
                    <td className="px-2 py-1 text-center tabular-nums">{e.moyenne !== null ? `${e.moyenne} / 20` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

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
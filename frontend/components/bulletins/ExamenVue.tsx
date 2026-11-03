import { dateFr } from '@/lib/format';
import type { ExamenDocument } from '@/lib/bulletin-types';

const ROMAIN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const CLASSES: Record<string, string> = { '11e': 'Onzième', '10e': 'Dixième', '9e': 'Neuvième', '8e': 'Huitième', '7e': 'Septième' };
const note = (n: number | null) => (n === null ? '—' : n.toFixed(2).replace('.', ','));

// Document d'un examen blanc : disciplines, coefficients, note sur 20 et note pondérée, moyennes et résultat
export function ExamenVue({ d }: { d: ExamenDocument }) {
  return (
    <article className="bulletin rounded-lg border border-border bg-card p-5 print:border-0 print:p-0">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-16 w-auto shrink-0" />
          <address className="text-sm not-italic text-muted-foreground">
            Les Colibris<br />33, avenue Gandhi Mahamasina<br />Tananarive · +261 32 99 124 86
          </address>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Année scolaire {d.annee}</p>
          <h2 className="text-2xl font-semibold uppercase">Examen blanc {ROMAIN[d.numero] ?? d.numero}</h2>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold">{d.eleve.nom.toUpperCase()} {d.eleve.prenom}</p>
        <p>Classe : {CLASSES[d.niveau] ?? d.niveau}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse border border-foreground text-sm">
          <caption className="sr-only">Notes de l&apos;examen blanc {d.numero}</caption>
          <thead>
            <tr className="border-b border-foreground">
              <th scope="col" className="border-r border-foreground px-3 py-3 text-left">Disciplines</th>
              <th scope="col" className="border-r border-foreground px-3 py-3 text-center">Coefficient</th>
              <th scope="col" className="border-r border-foreground px-3 py-3 text-center">Note sur 20</th>
              <th scope="col" className="px-3 py-3 text-center">Note avec coefficient</th>
            </tr>
          </thead>
          <tbody>
            {d.lignes.map((l) => (
              <tr key={l.discipline} className="border-b border-foreground">
                <th scope="row" className="border-r border-foreground px-3 py-3 text-left font-medium">{l.discipline}</th>
                <td className="border-r border-foreground px-3 py-3 text-center tabular-nums">{l.coefficient}</td>
                <td className="border-r border-foreground px-3 py-3 text-right tabular-nums">{note(l.note)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{note(l.pondere)}</td>
              </tr>
            ))}
            <tr className="border-b border-foreground font-semibold">
              <th scope="row" className="border-r border-foreground px-3 py-3 text-left">TOTAL</th>
              <td className="border-r border-foreground px-3 py-3 text-center tabular-nums">{d.totaux.coefficients}</td>
              <td className="border-r border-foreground px-3 py-3 text-right tabular-nums">{note(d.totaux.notes)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{note(d.totaux.pondere)}</td>
            </tr>
            <tr className="border-b border-foreground font-semibold">
              <th scope="row" colSpan={2} className="border-r border-foreground px-3 py-3 text-left">Moyenne de l&apos;élève</th>
              <td className="border-r border-foreground px-3 py-3 text-right tabular-nums">{note(d.moyenneSimple)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{note(d.moyennePonderee)}</td>
            </tr>
            <tr className="font-semibold">
              <th scope="row" className="border-r border-foreground px-3 py-3 text-left">Résultat à l&apos;examen</th>
              <td className="px-3 py-3 text-center" colSpan={3}>{d.resultat ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!d.complet && <p className="mt-2 text-sm text-muted-foreground">Toutes les notes ne sont pas encore saisies : les totaux et moyennes seront calculés une fois l&apos;examen complet.</p>}

      <p className="mt-6">Tananarive, le {dateFr(d.date)}</p>
      <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
        <div><p>L&apos;enseignante,</p><div className="h-20" /><p className="font-medium">{d.enseignant}</p></div>
        <div className="text-right"><p>La directrice</p><div className="h-20" /><p className="font-medium">{d.directrice}</p></div>
      </div>
      <p className="mt-8 text-xs italic text-muted-foreground">Ce bulletin est à conserver, aucun duplicata ne sera délivré.</p>
    </article>
  );
}
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dateFr } from '@/lib/format';
import { LIBELLES_NIVEAU, ORDRE_NIVEAUX } from '@/lib/bulletin-types';
import type { BulletinDetail, NiveauBulletin } from '@/lib/bulletin-types';
import { Textarea } from '@/components/ui/textarea';

// Format papier : A4 portrait, marges 10 mm, 2 pages maximum (recto verso)
const MARGE_MM = 10;
const HAUTEUR_UTILE_PX = (297 - 2 * MARGE_MM) * (96 / 25.4); // une page
const CAPACITE_PX = HAUTEUR_UTILE_PX * 2 * 0.95; // 5 % de réserve : les lignes ne se coupent pas entre deux pages
const TAILLE_MAX_PT = 10.5;
const TAILLE_MIN_PT = 6.5;

const semestreLibelle = (n: number) => `${n === 1 ? '1er' : `${n}e`} semestre`;

interface Props {
  b: BulletinDetail;
  // Fourni = l'enseignante coche directement dans le tableau ; absent = lecture seule (Direction, parents, impression)
  onChoisir?: (elementId: number, niveau: NiveauBulletin | null) => void;
  desactive?: boolean;
  // Fourni = l'appréciation (facultative) se rédige directement dans le bulletin ; absent = simple affichage
  edition?: { texte: string; max: number; modifie: boolean; enCours: boolean; onChange: (t: string) => void; onEnregistrer: () => void };
}

function Case({ id, libelle, niveau, valeur, onChoisir, desactive }: {
  id: number; libelle: string; niveau: NiveauBulletin; valeur: NiveauBulletin | null;
  onChoisir?: Props['onChoisir']; desactive?: boolean;
}) {
  const coche = valeur === niveau;
  return (
    <td className="relative h-6 border border-black p-0 text-center align-middle">
      {coche && <span aria-hidden="true" className="text-[1.15em] leading-none">✓</span>}
      {onChoisir ? (
        <button
          type="button" aria-pressed={coche} disabled={desactive}
          aria-label={`${libelle} : ${LIBELLES_NIVEAU[niveau]}`}
          title={coche ? 'Cliquer pour effacer' : LIBELLES_NIVEAU[niveau]}
          onClick={() => onChoisir(id, coche ? null : niveau)}
          className="absolute inset-0 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:opacity-50 print:hidden"
        />
      ) : (
        coche && <span className="sr-only">{LIBELLES_NIVEAU[niveau]}</span>
      )}
    </td>
  );
}

export function BulletinVue({ b, onChoisir, desactive, edition }: Props) {
  const feuille = useRef<HTMLElement>(null);
  const [taille, setTaille] = useState(TAILLE_MAX_PT);
  const [deborde, setDeborde] = useState(false);

  // Réduit la taille du texte, au besoin, jusqu'à ce que le bulletin tienne sur 2 pages
  const ajuster = useCallback(() => {
    const el = feuille.current;
    if (!el) return;
    let t = TAILLE_MAX_PT;
    el.style.setProperty('--pt', `${t}pt`);
    while (el.scrollHeight > CAPACITE_PX && t > TAILLE_MIN_PT) {
      t = Math.round((t - 0.25) * 100) / 100;
      el.style.setProperty('--pt', `${t}pt`);
    }
    setTaille(t);
    setDeborde(el.scrollHeight > CAPACITE_PX);
  }, []);

  useLayoutEffect(() => { ajuster(); }, [ajuster, b]);
  useEffect(() => {
    window.addEventListener('beforeprint', ajuster); // dernière vérification juste avant l'impression
    void document.fonts?.ready.then(ajuster);          // les polices chargées changent la hauteur du texte
    return () => window.removeEventListener('beforeprint', ajuster);
  }, [ajuster]);

  const dateBulletin = dateFr(b.datePublication ?? new Date().toISOString());

  return (
    <div>
      <style>{`
        @page { size: A4 portrait; margin: ${MARGE_MM}mm; }
        @media print {
          .no-print { display: none !important; }
          .feuille-bulletin { box-shadow: none !important; border: 0 !important; padding: 0 !important; width: auto !important; margin: 0 !important; }
          .feuille-bulletin thead { display: table-header-group; }
          .feuille-bulletin tr { break-inside: avoid; }
          .feuille-bulletin { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="overflow-x-auto print:overflow-visible">
        <article
          ref={feuille}
          aria-label={`Bulletin du ${semestreLibelle(b.semestre)} de ${b.eleve.prenom} ${b.eleve.nom}`}
          className="feuille-bulletin mx-auto border border-border bg-white p-[10mm] text-black shadow-sm"
          style={{ width: '210mm', fontSize: 'var(--pt, 10.5pt)', lineHeight: 1.25 }}
        >
          {/* En-tête : établissement à gauche, année / classe / semestre à droite */}
          <header className="mb-3 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-[18mm] w-auto shrink-0" />
              <div className="font-heading">
                <p className="text-[1.6em] font-semibold italic leading-none">Les Colibris</p>
                <p className="mt-1 text-[0.7em] leading-tight">33, avenue Gandhi Mahamasina<br />TANANARIVE · +261 32 99 124 86</p>
              </div>
            </div>
            <div className="text-right text-[0.85em] font-semibold leading-snug">
              <p>Année scolaire {b.annee}</p>
              <p>Classe {b.niveau}</p>
              <p>{semestreLibelle(b.semestre)}</p>
            </div>
          </header>

          <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
            <p className="text-[1.15em] font-semibold">
              <span className="uppercase">{b.eleve.nom}</span> <span className="font-heading italic font-normal">{b.eleve.prenom}</span>
            </p>
            <p className="text-[0.75em] italic">
              {ORDRE_NIVEAUX.map((n, i) => (<span key={n}>{i > 0 && '   '}{n} : {LIBELLES_NIVEAU[n]}.</span>))}
            </p>
          </div>

          {b.disciplines.length === 0 ? (
            <p className="py-6 text-center">Aucun contenu pour ce semestre.</p>
          ) : (
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup><col /><col style={{ width: '9mm' }} /><col style={{ width: '9mm' }} /><col style={{ width: '9mm' }} /></colgroup>
              <thead>
                <tr>
                  <td className="border-0 p-0" />
                  {ORDRE_NIVEAUX.map((n) => (
                    <th key={n} scope="col" className="border border-black py-0.5 text-center text-[0.8em] font-semibold" title={LIBELLES_NIVEAU[n]}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.disciplines.map((d) => (
                  <DisciplineLignes key={d.id} d={d} onChoisir={onChoisir} desactive={desactive} />
                ))}
              </tbody>
            </table>
          )}

          {(edition || b.appreciation) && (
            <section className={`mt-3 break-inside-avoid border border-black p-2 text-[0.9em] ${(edition ? edition.texte : b.appreciation) ? '' : 'print:hidden'}`}>
              <p className="font-semibold">Appréciation générale <span className="no-print font-normal text-[0.85em] italic">(facultative)</span></p>
              {edition ? (
                <>
                  <Textarea
                    aria-label="Appréciation générale (facultative)" value={edition.texte} maxLength={edition.max} rows={3}
                    placeholder="Écrire une appréciation (facultatif)…"
                    onChange={(e) => edition.onChange(e.target.value)}
                    onBlur={() => { if (edition.modifie && !edition.enCours) edition.onEnregistrer(); }}
                    className="mt-1 bg-white font-heading text-[1em] italic text-black print:hidden"
                  />
                  <p className="hidden whitespace-pre-wrap font-heading italic print:block">{edition.texte}</p>
                  <div className="no-print mt-1 flex items-center justify-between gap-2 text-[0.8em]">
                    <span>{edition.texte.length} / {edition.max} caractères</span>
                    <button type="button" onClick={edition.onEnregistrer} disabled={edition.enCours || !edition.modifie} className="h-9 rounded border border-black px-3 font-semibold disabled:opacity-50">
                      {edition.enCours ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="whitespace-pre-wrap font-heading italic">{b.appreciation}</p>
              )}
            </section>
          )}

          <footer className="mt-4 break-inside-avoid">
            <p className="text-[0.95em] font-semibold">Tananarive, le {dateBulletin}</p>
            <div className="mt-1 flex justify-between text-[0.85em]">
              <div className="text-center">
                <p>L&apos;enseignante</p>
                <p className="mt-8 font-semibold uppercase">{b.enseignant ?? ' '}</p>
              </div>
              <div className="text-center">
                <p>La direction</p>
                <p className="mt-8 font-semibold uppercase">{b.directrice ?? ' '}</p>
              </div>
            </div>
            <p className="mt-2 text-center text-[0.7em] italic">Ce bulletin est à conserver, aucun duplicata ne sera délivré.</p>
          </footer>
        </article>
      </div>

      {/* Indications de mise en page : jamais imprimées */}
      <p className="no-print mt-2 text-center text-sm text-muted-foreground" aria-live="polite">
        {deborde
          ? 'Attention : même avec le texte le plus petit, ce bulletin dépasse 2 pages. Réduisez le contenu du semestre (menu « Contenu du bulletin »).'
          : `Mise en page : tient sur 2 pages maximum (recto verso), texte ${taille.toString().replace('.', ',')} pt.`}
      </p>
    </div>
  );
}

function DisciplineLignes({ d, onChoisir, desactive }: { d: BulletinDetail['disciplines'][number]; onChoisir?: Props['onChoisir']; desactive?: boolean }) {
  return (
    <>
      <tr>
        <th colSpan={4} scope="colgroup" className="border border-black bg-white px-2 py-1 text-center text-[0.95em] font-bold uppercase">{d.titre}</th>
      </tr>
      {d.rubriques.map((r, k) => (
        <RubriqueLignes key={r.id ?? `direct-${k}`} r={r} onChoisir={onChoisir} desactive={desactive} />
      ))}
    </>
  );
}

function RubriqueLignes({ r, onChoisir, desactive }: { r: BulletinDetail['disciplines'][number]['rubriques'][number]; onChoisir?: Props['onChoisir']; desactive?: boolean }) {
  // Une ligne retirée du contenu n'apparaît que si elle a déjà été évaluée (l'historique reste fidèle)
  const lignes = r.lignes.filter((l) => !l.archive || l.niveau !== null);
  if (lignes.length === 0) return null;
  return (
    <>
      {r.titre && (
        <tr>
          <th scope="row" className="border border-black px-2 py-0.5 text-left font-bold">▶ {r.titre}</th>
          <td className="border border-black" /><td className="border border-black" /><td className="border border-black" />
        </tr>
      )}
      {lignes.map((l) => (
        <tr key={l.id}>
          <th scope="row" className="border border-black px-2 py-0.5 text-left font-heading text-[0.95em] font-normal italic">* {l.libelle}</th>
          {ORDRE_NIVEAUX.map((n) => (
            <Case key={n} id={l.id} libelle={l.libelle} niveau={n} valeur={l.niveau} onChoisir={onChoisir && !l.archive ? onChoisir : undefined} desactive={desactive} />
          ))}
        </tr>
      ))}
    </>
  );
}
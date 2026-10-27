'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type {
  CeinturesPedago, ElementsPedago, EvaluationsElement, NiveauAcquis, SallePedago,
} from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Saisie = Record<number, NiveauAcquis | null>;
const CHOIX: { valeur: NiveauAcquis | null; court: string; long: string }[] = [
  { valeur: 'A', court: 'A', long: 'Acquis' },
  { valeur: 'EA', court: 'EA', long: "En cours d'acquisition" },
  { valeur: 'AR', court: 'AR', long: 'À renforcer' },
  { valeur: null, court: '—', long: 'Non évalué' },
];
const STATUTS: Record<string, string> = { aucun: 'Pas encore abordé', en_cours: 'En cours', termine: 'Terminé' };

export function Evaluations({ peutSaisir }: { peutSaisir: boolean }) {
  const [salles, setSalles] = useState<SallePedago[]>([]);
  const [salleId, setSalleId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [cs, setCs] = useState<CeinturesPedago | null>(null);
  const [ceintureId, setCeintureId] = useState('');
  const [els, setEls] = useState<ElementsPedago | null>(null);
  const [elementId, setElementId] = useState<number | null>(null);
  const [ev, setEv] = useState<EvaluationsElement | null>(null);
  const [saisie, setSaisie] = useState<Saisie>({});
  const [initial, setInitial] = useState<Saisie>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const panneauRef = useRef<HTMLElement>(null);

  const salle = salles.find((s) => String(s.id) === salleId);

  useEffect(() => {
    api.get<SallePedago[]>('/pedagogie/salles')
      .then((s) => { setSalles(s); if (s.length === 1) setSalleId(String(s[0].id)); })
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  // Salle -> niveau (présélectionné s'il n'y en a qu'un)
  useEffect(() => {
    const s = salles.find((x) => String(x.id) === salleId);
    setNiveauId(s && s.niveaux.length === 1 ? String(s.niveaux[0].id) : '');
  }, [salleId, salles]);

  // Niveau -> ceintures
  useEffect(() => {
    setCs(null); setCeintureId(''); setEls(null); setElementId(null); setEv(null);
    if (!salleId || !niveauId) return;
    api.get<CeinturesPedago>(`/pedagogie/ceintures?salleId=${salleId}&niveauId=${niveauId}`)
      .then((c) => { setCs(c); if (c.ceintures.length > 0) setCeintureId(String(c.ceintures[0].id)); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [salleId, niveauId]);

  const chargerElements = useCallback(() => {
    if (!salleId || !niveauId || !ceintureId) return;
    api.get<ElementsPedago>(`/pedagogie/elements?salleId=${salleId}&niveauId=${niveauId}&ceintureId=${ceintureId}`)
      .then((d) => { setEls(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [salleId, niveauId, ceintureId]);
  useEffect(() => { setEls(null); setElementId(null); setEv(null); chargerElements(); }, [chargerElements]);

  const chargerEleves = useCallback(() => {
    if (elementId === null) return;
    api.get<EvaluationsElement>(`/pedagogie/evaluations?salleId=${salleId}&niveauId=${niveauId}&elementId=${elementId}`)
      .then((d) => {
        const s: Saisie = {};
        d.eleves.forEach((e) => { s[e.inscriptionId] = e.niveau; });
        setEv(d); setSaisie(s); setInitial(s); setErreur(null);
      })
      .catch((e) => setErreur(messageErreur(e)));
  }, [salleId, niveauId, elementId]);
  useEffect(() => { setEv(null); chargerEleves(); }, [chargerEleves]);

  const modifie = useMemo(
    () => Object.keys({ ...saisie, ...initial }).some((k) => (saisie[+k] ?? null) !== (initial[+k] ?? null)),
    [saisie, initial],
  );

    function choisirElement(id: number) {
    if (id === elementId) return;
    if (modifie && !window.confirm('Des modifications ne sont pas enregistrées. Changer quand même ?')) return;
    setInfo(null);
    setElementId(id);
    // Sur petit écran, le panneau d'évaluation est sous la liste : on y amène la vue
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      const sansAnimation = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() =>
        panneauRef.current?.scrollIntoView({ behavior: sansAnimation ? 'auto' : 'smooth', block: 'start' }),
      );
    }
  }

  async function enregistrer() {
    if (!ev || elementId === null || enCours) return;
    const notes = ev.eleves
      .filter((e) => (saisie[e.inscriptionId] ?? null) !== (initial[e.inscriptionId] ?? null))
      .map((e) => ({ inscriptionId: e.inscriptionId, niveau: saisie[e.inscriptionId] ?? null }));
    if (notes.length === 0) return;
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      const r = await api.post<{ creees: number; modifiees: number; retirees: number }>('/pedagogie/evaluations', {
        salleId: Number(salleId), niveauId: Number(niveauId), elementId, notes,
      });
      setInfo(`Évaluations enregistrées : ${r.creees} ajoutée(s), ${r.modifiees} modifiée(s), ${r.retirees} retirée(s).`);
      chargerEleves();
      chargerElements();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function changerSuivi(cibleId: number, etat: string) {
    setErreur(null); setInfo(null);
    try {
      await api.post('/pedagogie/suivi', { salleId: Number(salleId), niveauId: Number(niveauId), cibleId, etat });
      chargerElements();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  function marquerNonEvaluesAcquis() {
    if (!ev) return;
    setSaisie((prev) => {
      const suivant = { ...prev };
      ev.eleves.forEach((e) => { if ((suivant[e.inscriptionId] ?? null) === null) suivant[e.inscriptionId] = 'A'; });
      return suivant;
    });
  }

  const libelleElement = els?.type === 'domaines' ? 'compétence' : 'leçon';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44 space-y-1.5">
          <Label htmlFor="ev-salle" className="text-base">Salle</Label>
          <Select value={salleId} onValueChange={setSalleId} disabled={salles.length === 1}>
            <SelectTrigger id="ev-salle" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{salles.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1.5">
          <Label htmlFor="ev-niveau" className="text-base">Niveau</Label>
          <Select value={niveauId} onValueChange={setNiveauId} disabled={!salle}>
            <SelectTrigger id="ev-niveau" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{salle?.niveaux.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-60 space-y-1.5">
          <Label htmlFor="ev-ceinture" className="text-base">Ceinture</Label>
          <Select value={ceintureId} onValueChange={setCeintureId} disabled={!cs || cs.ceintures.length === 0}>
            <SelectTrigger id="ev-ceinture" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>
              {cs?.ceintures.map((c) => <SelectItem key={c.id} value={String(c.id)}>Semestre {c.semestre} · {c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {cs && <p className="pb-2 text-sm text-muted-foreground">{cs.effectif} élève(s) validé(s)</p>}
      </div>

      {salles.length === 0 && (
        <Alert role="status" className="mb-4"><AlertDescription>Aucune salle ne vous est affectée. Contactez l&apos;administration.</AlertDescription></Alert>
      )}
      {cs && cs.ceintures.length === 0 && (
        <Alert role="status" className="mb-4"><AlertDescription>Le référentiel de ce niveau est vide. Demandez à l&apos;administrateur de charger le référentiel pédagogique.</AlertDescription></Alert>
      )}
      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      {els && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* ---------- Liste des compétences / leçons ---------- */}
          <section aria-label={`Liste des ${libelleElement}s`} className="space-y-5">
            {els.groupes.length === 0 && <p className="text-muted-foreground">Aucune {libelleElement} pour cette ceinture.</p>}
            {els.groupes.map((g) => (
              <div key={g.id} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{g.titre}</h2>
                  {els.type === 'domaines' && (
                    peutSaisir ? (
                      <Select value={g.statut ?? 'aucun'} onValueChange={(v) => changerSuivi(g.id, v)}>
                        <SelectTrigger aria-label={`Avancement du domaine ${g.titre}`} className="h-9 w-56 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge variant="outline">{STATUTS[g.statut ?? 'aucun']}</Badge>
                  )}
                </div>
                {g.sections.map((s, i) => (
                  <div key={i} className="mb-2">
                    {s.titre && <h3 className="mb-1 text-sm font-medium text-muted-foreground">{s.titre}</h3>}
                    <ul className="space-y-1">
                      {s.elements.map((el) => (
                        <li key={el.id} className="flex items-start gap-2">
                          <button
                            type="button" onClick={() => choisirElement(el.id)} aria-pressed={elementId === el.id}
                            className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-left text-sm ${elementId === el.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                          >
                            <span className="block">{el.libelle}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{el.evalues} / {els.effectif} évalué(s)</span>
                          </button>
                          {els.type === 'lecons' && (
                            <label className="flex min-h-11 items-center gap-1.5 text-sm">
                              <input
                                type="checkbox" className="size-5 accent-primary" checked={!!el.vu} disabled={!peutSaisir}
                                onChange={(e) => changerSuivi(el.id, e.target.checked ? 'vu' : 'aucun')}
                                aria-label={`Leçon vue en classe : ${el.libelle}`}
                              />
                              Vue
                            </label>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </section>

          {/* ---------- Évaluation des élèves ---------- */}
          <section
            ref={panneauRef}
            aria-label="Évaluation des élèves"
            className="scroll-mt-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto"
          >
            {!ev ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                {elementId === null ? `Choisissez une ${libelleElement} dans la liste pour évaluer les élèves.` : 'Chargement...'}
              </p>
            ) : (
              <>
                <h2 className="mb-1 text-lg font-semibold">{ev.element.libelle}</h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  <strong>A</strong> acquis · <strong>EA</strong> en cours d&apos;acquisition · <strong>AR</strong> à renforcer
                </p>
                {ev.eleves.length === 0 ? (
                  <Alert role="status"><AlertDescription>Aucun élève validé dans cette classe.</AlertDescription></Alert>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                    {ev.eleves.map((e) => (
                      <li key={e.inscriptionId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span id={`el-${e.inscriptionId}`} className="font-medium">{e.prenom} {e.nom}</span>
                        <div role="radiogroup" aria-labelledby={`el-${e.inscriptionId}`} className="flex gap-1">
                          {CHOIX.map((c) => (
                            <label key={c.court} title={c.long} className={peutSaisir ? 'cursor-pointer' : 'cursor-default'}>
                              <input
                                type="radio" className="peer sr-only" name={`n-${e.inscriptionId}`} disabled={!peutSaisir}
                                checked={(saisie[e.inscriptionId] ?? null) === c.valeur}
                                onChange={() => { setInfo(null); setSaisie((p) => ({ ...p, [e.inscriptionId]: c.valeur })); }}
                                aria-label={`${e.prenom} ${e.nom} : ${c.long}`}
                              />
                              <span className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-2 text-sm font-medium peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                                {c.court}
                              </span>
                            </label>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {peutSaisir && ev.eleves.length > 0 && (
                  <div className="sticky bottom-0 mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-3">
                    <p className="text-sm" aria-live="polite">{modifie ? 'Modifications non enregistrées' : 'Tout est enregistré'}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={marquerNonEvaluesAcquis} disabled={enCours}>Non évalués : Acquis</Button>
                      <Button size="lg" onClick={enregistrer} disabled={enCours || !modifie}>{enCours ? 'Enregistrement...' : 'Enregistrer'}</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
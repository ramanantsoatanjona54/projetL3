'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { SallePedago } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CeintureOption { id: number; nom: string; semestre: number }
interface Ceintures { type: 'domaines' | 'lecons'; effectif: number; ceintures: CeintureOption[] }
interface Element { id: number; libelle: string; vu?: boolean }
interface Section { titre: string | null; elements: Element[] }
interface Groupe { id: number; titre: string; statut?: string | null; sections: Section[] }
interface Elements { type: 'domaines' | 'lecons'; effectif: number; groupes: Groupe[] }

const STATUTS: Record<string, string> = { aucun: 'Pas encore abordé', en_cours: 'En cours', termine: 'Terminé' };

// Suivi pédagogique de la classe : ce qui a été VU en classe. Aucune note d'élève ici :
// les niveaux A / EA / AR / NA se saisissent dans le bulletin de chaque élève.
export function Evaluations({ peutSaisir }: { peutSaisir: boolean }) {
  const [salles, setSalles] = useState<SallePedago[]>([]);
  const [salleId, setSalleId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [cs, setCs] = useState<Ceintures | null>(null);
  const [ceintureId, setCeintureId] = useState('');
  const [els, setEls] = useState<Elements | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const salle = salles.find((s) => String(s.id) === salleId);

  useEffect(() => {
    api.get<SallePedago[]>('/pedagogie/salles')
      .then((s) => { setSalles(s); if (s.length === 1) setSalleId(String(s[0].id)); })
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  useEffect(() => {
    const s = salles.find((x) => String(x.id) === salleId);
    setNiveauId(s && s.niveaux.length === 1 ? String(s.niveaux[0].id) : '');
  }, [salleId, salles]);

  useEffect(() => {
    setCs(null); setCeintureId(''); setEls(null);
    if (!salleId || !niveauId) return;
    api.get<Ceintures>(`/pedagogie/ceintures?salleId=${salleId}&niveauId=${niveauId}`)
      .then((c) => { setCs(c); if (c.ceintures.length > 0) setCeintureId(String(c.ceintures[0].id)); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [salleId, niveauId]);

  const chargerElements = useCallback(() => {
    if (!salleId || !niveauId || !ceintureId) return;
    api.get<Elements>(`/pedagogie/elements?salleId=${salleId}&niveauId=${niveauId}&ceintureId=${ceintureId}`)
      .then((d) => { setEls(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [salleId, niveauId, ceintureId]);
  useEffect(() => { setEls(null); chargerElements(); }, [chargerElements]);

  async function changerSuivi(cibleId: number, etat: string) {
    setErreur(null);
    try {
      await api.post('/pedagogie/suivi', { salleId: Number(salleId), niveauId: Number(niveauId), cibleId, etat });
      chargerElements();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const nbVues = els?.type === 'lecons' ? els.groupes.reduce((n, g) => n + g.sections.reduce((m, s) => m + s.elements.filter((x) => x.vu).length, 0), 0) : 0;
  const nbTotal = els?.type === 'lecons' ? els.groupes.reduce((n, g) => n + g.sections.reduce((m, s) => m + s.elements.length, 0), 0) : 0;
  const nbTermines = els?.type === 'domaines' ? els.groupes.filter((g) => g.statut === 'termine').length : 0;

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
      </div>

      {salles.length === 0 && !erreur && (
        <Alert role="status" className="mb-4"><AlertDescription>Aucune salle ne vous est affectée. Contactez l&apos;administration.</AlertDescription></Alert>
      )}
      {cs && cs.ceintures.length === 0 && (
        <Alert role="status" className="mb-4"><AlertDescription>Le programme de ce niveau est vide. Demandez à l&apos;administrateur de le renseigner.</AlertDescription></Alert>
      )}
      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}

      {els && (
        <>
          <p className="mb-3 text-base" aria-live="polite">
            {els.type === 'lecons' ? <><strong>{nbVues}</strong> leçon(s) vue(s) sur {nbTotal}.</> : <><strong>{nbTermines}</strong> domaine(s) terminé(s) sur {els.groupes.length}.</>}
          </p>
          <div className="space-y-5">
            {els.groupes.length === 0 && <p className="text-muted-foreground">Rien à suivre pour cette ceinture.</p>}
            {els.groupes.map((g) => (
              <section key={g.id} aria-label={g.titre} className="rounded-lg border border-border bg-card p-3">
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
                        <li key={el.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                          <span className="flex-1 text-sm">{el.libelle}</span>
                          {els.type === 'lecons' && (
                            <label className="flex min-h-9 items-center gap-1.5 text-sm">
                              <input
                                type="checkbox" className="size-5 accent-primary" checked={!!el.vu} disabled={!peutSaisir}
                                onChange={(e) => changerSuivi(el.id, e.target.checked ? 'vu' : 'aucun')}
                                aria-label={`Leçon vue en classe : ${el.libelle}`}
                              />
                              Vue en classe
                            </label>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
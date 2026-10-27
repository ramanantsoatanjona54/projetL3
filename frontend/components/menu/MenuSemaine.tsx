'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { aujourdhuiIso, decalerJour } from '@/lib/pointage';
import { jourLong, lundiDe } from '@/lib/communication';
import type { JourMenuSemaine, SemaineMenu } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const VIDE = { entree: '', platPrincipal: '', dessert: '' };

export function MenuSemaine({ peutModifier }: { peutModifier: boolean }) {
  const aujourdhui = aujourdhuiIso();
  const lundiCourant = lundiDe(aujourdhui);
  const [lundi, setLundi] = useState(lundiCourant);
  const [semaine, setSemaine] = useState<SemaineMenu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [cible, setCible] = useState<JourMenuSemaine | null>(null);
  const [form, setForm] = useState(VIDE);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    api.get<SemaineMenu>(`/menu/semaine?date=${lundi}`)
      .then((s) => { setSemaine(s); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [lundi]);
  useEffect(() => { setSemaine(null); charger(); }, [charger]);

  function ouvrir(j: JourMenuSemaine) {
    setForm({ entree: j.menu?.entree ?? '', platPrincipal: j.menu?.platPrincipal ?? '', dessert: j.menu?.dessert ?? '' });
    setErreurModale(null); setCible(j);
  }

  async function enregistrer() {
    if (!cible?.periode) return;
    if (!form.entree.trim() && !form.platPrincipal.trim() && !form.dessert.trim()) {
      setErreurModale('Renseignez au moins un plat.'); return;
    }
    setEnCours(true); setErreurModale(null);
    try {
      await api.post(`/menu/periodes/${cible.periode.id}/jours`, { date: cible.date, ...form });
      setInfo('Menu enregistré.');
      setCible(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function effacer() {
    if (!cible?.periode) return;
    setEnCours(true); setErreurModale(null);
    try {
      await api.delete(`/menu/periodes/${cible.periode.id}/jours/${cible.date}`);
      setInfo('Menu supprimé pour ce jour.');
      setCible(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setLundi((l) => decalerJour(l, -7))} aria-label="Semaine précédente">&larr;</Button>
        <p className="min-w-56 text-center text-lg capitalize" aria-live="polite">
          {semaine ? `Du ${jourLong(semaine.lundi)} au ${jourLong(semaine.vendredi)}` : '...'}
        </p>
        <Button variant="outline" onClick={() => setLundi((l) => decalerJour(l, 7))} aria-label="Semaine suivante">&rarr;</Button>
        {lundi !== lundiCourant && <Button variant="ghost" onClick={() => setLundi(lundiCourant)}>Cette semaine</Button>}
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      <ul className="grid gap-3 md:grid-cols-5">
        {semaine?.jours.map((j) => (
          <li key={j.date} className={`rounded-lg border bg-card p-4 ${j.date === aujourdhui ? 'border-primary' : 'border-border'}`}>
            <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold capitalize">
              {jourLong(j.date).split(' ').slice(0, 2).join(' ')}
              {j.date === aujourdhui && <Badge>Aujourd&apos;hui</Badge>}
            </p>
            {j.menu ? (
              <dl className="space-y-2 text-sm">
                {j.menu.entree && <div><dt className="text-muted-foreground">Entrée</dt><dd>{j.menu.entree}</dd></div>}
                {j.menu.platPrincipal && <div><dt className="text-muted-foreground">Plat</dt><dd className="font-medium">{j.menu.platPrincipal}</dd></div>}
                {j.menu.dessert && <div><dt className="text-muted-foreground">Dessert</dt><dd>{j.menu.dessert}</dd></div>}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Menu non renseigné.</p>
            )}
            {peutModifier && (
              j.periode ? (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => ouvrir(j)}
                  aria-label={`${j.menu ? 'Modifier' : 'Renseigner'} le menu du ${jourLong(j.date)}`}>
                  {j.menu ? 'Modifier' : 'Renseigner'}
                </Button>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Aucune période : créez-en une dans l&apos;onglet « Périodes ».</p>
              )
            )}
          </li>
        ))}
      </ul>

      <ModaleCrud
        ouvert={!!cible} titre="Menu du jour"
        description={cible ? `${jourLong(cible.date)} · ${cible.periode?.nom ?? ''}` : ''}
        libelleValider="Enregistrer" enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setCible(null); }} onValider={enregistrer}
      >
        <div className="space-y-4">
          {([['entree', 'Entrée'], ['platPrincipal', 'Plat principal'], ['dessert', 'Dessert']] as const).map(([cle, libelle]) => (
            <div key={cle} className="space-y-1.5">
              <Label htmlFor={`menu-${cle}`} className="text-base">{libelle}</Label>
              <Input id={`menu-${cle}`} maxLength={120} value={form[cle]}
                onChange={(e) => setForm((f) => ({ ...f, [cle]: e.target.value }))} className="h-11 text-base" />
            </div>
          ))}
          {cible?.menu && (
            <Button type="button" variant="ghost" onClick={effacer} disabled={enCours}>Effacer le menu de ce jour</Button>
          )}
        </div>
      </ModaleCrud>
    </div>
  );
}
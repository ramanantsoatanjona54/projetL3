'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { aujourdhuiIso, decalerJour, libelleJour } from '@/lib/pointage';
import type { AppelJour, SalleSimple } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AppelDuJour() {
  const aujourdhui = aujourdhuiIso();
  const [salles, setSalles] = useState<SalleSimple[] | null>(null);
  const [salleId, setSalleId] = useState('');
  const [date, setDate] = useState(aujourdhui);
  const [appel, setAppel] = useState<AppelJour | null>(null);
  const [absents, setAbsents] = useState<Set<number>>(new Set());
  const [initiaux, setInitiaux] = useState<Set<number>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api.get<SalleSimple[]>('/absences/salles')
      .then((s) => { setSalles(s); if (s.length === 1) setSalleId(String(s[0].id)); })
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  const charger = useCallback(() => {
    if (!salleId || !date) return;
    api.get<AppelJour>(`/absences/appel?salleId=${salleId}&date=${date}`)
      .then((a) => {
        const ids = new Set(a.eleves.filter((e) => e.absence).map((e) => e.inscriptionId));
        setAppel(a); setAbsents(ids); setInitiaux(new Set(ids)); setErreur(null);
      })
      .catch((e) => setErreur(messageErreur(e)));
  }, [salleId, date]);

  useEffect(() => { setAppel(null); setInfo(null); charger(); }, [charger]);

  const modifie = useMemo(
    () => absents.size !== initiaux.size || [...absents].some((id) => !initiaux.has(id)),
    [absents, initiaux],
  );

  function basculer(id: number) {
    setInfo(null);
    setAbsents((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
      return suivant;
    });
  }

  function toutPresent() {
    if (!appel) return;
    // Les absences justifiées restent verrouillées
    setAbsents(new Set(appel.eleves.filter((e) => e.absence?.justifiee).map((e) => e.inscriptionId)));
  }

  async function enregistrer() {
    if (!appel || enCours) return;
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      const r = await api.post<{ ajoutees: number; retirees: number; totalAbsents: number }>('/absences/appel', {
        salleId: Number(salleId), date, inscriptionIdsAbsents: Array.from(absents),
      });
      setInfo(
        r.ajoutees + r.retirees === 0
          ? 'Aucun changement à enregistrer.'
          : `Appel enregistré : ${r.ajoutees} absence(s) ajoutée(s), ${r.retirees} retirée(s). Les parents concernés ont été prévenus.`,
      );
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44 space-y-1.5">
          <Label htmlFor="appel-salle" className="text-base">Salle</Label>
          <Select value={salleId} onValueChange={setSalleId} disabled={salles?.length === 1}>
            <SelectTrigger id="appel-salle" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{salles?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => setDate((d) => decalerJour(d, -1))} aria-label="Jour précédent">&larr;</Button>
        <div className="space-y-1.5">
          <Label htmlFor="appel-jour" className="text-base">Jour</Label>
          <Input id="appel-jour" type="date" value={date} max={aujourdhui} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 text-base" />
        </div>
        <Button variant="outline" disabled={date >= aujourdhui} onClick={() => setDate((d) => decalerJour(d, 1))} aria-label="Jour suivant">&rarr;</Button>
      </div>

      {salles && salles.length === 0 && (
        <Alert role="status" className="mb-4">
          <AlertDescription>Aucune salle ne vous est affectée. Contactez l&apos;administration pour renseigner votre salle dans votre fiche.</AlertDescription>
        </Alert>
      )}
      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      {appel && (
        <>
          <p className="mb-3 text-lg capitalize">
            {libelleJour(date)} · Salle {appel.salle.nom}
          </p>

          {!appel.ouvre ? (
            <Alert role="status"><AlertDescription>Jour non travaillé : il n&apos;y a pas d&apos;appel à faire.</AlertDescription></Alert>
          ) : appel.eleves.length === 0 ? (
            <Alert role="status"><AlertDescription>Aucun élève inscrit et validé dans cette salle à cette date.</AlertDescription></Alert>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {appel.eleves.map((e) => {
                  const absent = absents.has(e.inscriptionId);
                  const verrouille = !!e.absence?.justifiee;
                  return (
                    <li key={e.inscriptionId}>
                      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-2">
                        <span>
                          <span className="font-medium">{e.prenom} {e.nom}</span>
                          <span className="block text-sm text-muted-foreground">
                            {e.matricule}
                            {verrouille && <Badge variant="secondary" className="ml-2">Justifiée : {e.absence?.motif}</Badge>}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className={absent ? 'font-medium' : 'text-muted-foreground'}>{absent ? 'Absent' : 'Présent'}</span>
                          <input
                            type="checkbox" className="size-6 accent-primary" checked={absent} disabled={verrouille}
                            onChange={() => basculer(e.inscriptionId)} aria-label={`${e.prenom} ${e.nom} : absent`}
                          />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-3">
                <p className="text-sm" aria-live="polite">
                  <strong>{absents.size}</strong> absent(s) sur {appel.eleves.length}
                  {modifie && <span className="ml-2 text-muted-foreground">· modifications non enregistrées</span>}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={toutPresent} disabled={enCours}>Tous présents</Button>
                  <Button size="lg" onClick={enregistrer} disabled={enCours || !modifie}>
                    {enCours ? 'Enregistrement...' : "Enregistrer l'appel"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
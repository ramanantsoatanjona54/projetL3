'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { normaliser } from '@/lib/normaliser';
import { nomComplet } from '@/lib/personnel';
import { aujourdhuiIso, decalerJour, heureLocale, libelleJour, versIso } from '@/lib/pointage';
import type { PresenceAgent, PresencesJour } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

type TypeModale = 'corriger' | 'manuel' | 'annuler';

function statut(a: PresenceAgent, date: string, aujourdhui: string, ouvre: boolean) {
  const p = a.pointage;
  if (p?.heureDepart) return { label: 'Parti', variant: 'secondary' as const };
  if (p?.heureArrivee) {
    return date < aujourdhui
      ? { label: 'Départ non pointé', variant: 'secondary' as const }
      : { label: 'Présent', variant: 'default' as const };
  }
  if (!ouvre) return { label: 'Jour non travaillé', variant: 'outline' as const };
  if (date === aujourdhui) return { label: 'Pas encore arrivé', variant: 'outline' as const };
  return { label: 'Absent', variant: 'destructive' as const };
}

export function PointageJour({ admin }: { admin: boolean }) {
  const aujourdhui = aujourdhuiIso();
  const [date, setDate] = useState(aujourdhui);
  const [donnees, setDonnees] = useState<PresencesJour | null>(null);
  const [erreurPage, setErreurPage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [enCoursId, setEnCoursId] = useState<number | null>(null);

  const [modale, setModale] = useState<{ type: TypeModale; agent: PresenceAgent } | null>(null);
  const [arrivee, setArrivee] = useState('');
  const [depart, setDepart] = useState('');
  const [motif, setMotif] = useState('');
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCoursModale, setEnCoursModale] = useState(false);

  const charger = useCallback(() => {
    if (!date) return;
    api.get<PresencesJour>(`/rh/presences/jour?date=${date}`)
      .then((d) => { setDonnees(d); setErreurPage(null); })
      .catch((e) => setErreurPage(messageErreur(e)));
  }, [date]);

  useEffect(() => { setDonnees(null); setInfo(null); charger(); }, [charger]);

  const agents = donnees?.agents ?? [];
  const presents = agents.filter((a) => a.pointage?.heureArrivee).length;
  const partis = agents.filter((a) => a.pointage?.heureDepart).length;

  const affiches = useMemo(() => {
    const q = normaliser(recherche);
    return agents.filter((a) => !q || normaliser(`${a.nom} ${a.prenom} ${a.matricule} ${a.poste}`).includes(q));
  }, [agents, recherche]);

  async function pointerArrivee(a: PresenceAgent) {
    setEnCoursId(a.id); setInfo(null); setErreurPage(null);
    try {
      const r = await api.post<{ heureArrivee: string }>(`/rh/pointages/${a.id}/arrivee`, {});
      setInfo(`Arrivée de ${nomComplet(a)} enregistrée à ${heureLocale(r.heureArrivee)}.`);
      charger();
    } catch (e) {
      setErreurPage(messageErreur(e));
      charger();
    } finally {
      setEnCoursId(null);
    }
  }

  async function pointerDepart(a: PresenceAgent) {
    if (!a.pointage) return;
    setEnCoursId(a.id); setInfo(null); setErreurPage(null);
    try {
      const r = await api.post<{ heureDepart: string }>(`/rh/pointages/${a.pointage.id}/depart`, {});
      setInfo(`Départ de ${nomComplet(a)} enregistré à ${heureLocale(r.heureDepart)}.`);
      charger();
    } catch (e) {
      setErreurPage(messageErreur(e));
      charger();
    } finally {
      setEnCoursId(null);
    }
  }

  function ouvrir(type: TypeModale, agent: PresenceAgent) {
    setModale({ type, agent });
    setErreurModale(null);
    setMotif('');
    setArrivee(heureLocale(agent.pointage?.heureArrivee ?? null));
    setDepart(heureLocale(agent.pointage?.heureDepart ?? null));
  }

  async function valider() {
    if (!modale) return;
    const { type, agent } = modale;
    if (motif.trim().length < 5) { setErreurModale('Indiquez le motif (5 caractères minimum).'); return; }
    if (type !== 'annuler') {
      if (!arrivee) { setErreurModale("Saisissez l'heure d'arrivée."); return; }
      if (depart && depart <= arrivee) { setErreurModale("Le départ doit être après l'arrivée."); return; }
    }
    setEnCoursModale(true);
    setErreurModale(null);
    try {
      if (type === 'annuler' && agent.pointage) {
        await api.post(`/rh/pointages/${agent.pointage.id}/annuler`, { motif: motif.trim() });
      } else if (type === 'corriger' && agent.pointage) {
        await api.patch(`/rh/pointages/${agent.pointage.id}/corriger`, {
          heureArrivee: versIso(date, arrivee),
          heureDepart: depart ? versIso(date, depart) : null,
          motif: motif.trim(),
        });
      } else {
        await api.post('/rh/pointages/manuel', {
          personnelId: agent.id, date, heureArrivee: versIso(date, arrivee),
          ...(depart ? { heureDepart: versIso(date, depart) } : {}), motif: motif.trim(),
        });
      }
      setInfo(`Pointage de ${nomComplet(agent)} mis à jour.`);
      setModale(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCoursModale(false);
    }
  }

  const titres: Record<TypeModale, string> = {
    corriger: 'Corriger le pointage', manuel: 'Saisir un pointage', annuler: 'Annuler le pointage',
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Button variant="outline" onClick={() => setDate((d) => decalerJour(d, -1))} aria-label="Jour précédent">&larr;</Button>
        <div className="space-y-1.5">
          <Label htmlFor="jour" className="text-base">Jour</Label>
          <Input id="jour" type="date" value={date} max={aujourdhui} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-11 text-base" />
        </div>
        <Button variant="outline" disabled={date >= aujourdhui} onClick={() => setDate((d) => decalerJour(d, 1))} aria-label="Jour suivant">&rarr;</Button>
        {date !== aujourdhui && <Button variant="ghost" onClick={() => setDate(aujourdhui)}>Revenir à aujourd&apos;hui</Button>}
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="recherche-pointage" className="text-base">Rechercher</Label>
          <Input id="recherche-pointage" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, matricule, poste" className="h-11 text-base" />
        </div>
      </div>

      <p className="mb-4 text-lg capitalize">
        {libelleJour(date)}
        {donnees && (
          <span className="ml-3 text-sm normal-case text-muted-foreground">
            {donnees.ouvre ? `${presents} présent(s) · ${partis} parti(s) · ${agents.length} agents` : 'Jour non travaillé'}
          </span>
        )}
      </p>

      <div aria-live="polite">
        {info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}
      </div>
      {erreurPage && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreurPage}</AlertDescription></Alert>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead><TableHead>Arrivée</TableHead><TableHead>Départ</TableHead>
              <TableHead>Situation</TableHead>{admin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees ? (
              <TableRow><TableCell colSpan={admin ? 5 : 4} className="py-10 text-center text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : affiches.length === 0 ? (
              <TableRow><TableCell colSpan={admin ? 5 : 4} className="py-10 text-center text-muted-foreground">Aucun agent en poste ce jour-là.</TableCell></TableRow>
            ) : affiches.map((a) => {
              const s = statut(a, date, aujourdhui, donnees.ouvre);
              const p = a.pointage;
              const occupe = enCoursId === a.id;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className="font-medium">{nomComplet(a)}</span>
                    <span className="block text-sm text-muted-foreground">{a.poste} · {a.matricule}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{p?.heureArrivee ? heureLocale(p.heureArrivee) : '—'}</TableCell>
                  <TableCell className="tabular-nums">{p?.heureDepart ? heureLocale(p.heureDepart) : '—'}</TableCell>
                  <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                  {admin && (
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        {!p && date === aujourdhui && (
                          <Button size="sm" disabled={occupe} onClick={() => pointerArrivee(a)} aria-label={`Enregistrer l'arrivée de ${nomComplet(a)}`}>Arrivée</Button>
                        )}
                        {p && !p.heureDepart && date === aujourdhui && (
                          <Button size="sm" disabled={occupe} onClick={() => pointerDepart(a)} aria-label={`Enregistrer le départ de ${nomComplet(a)}`}>Départ</Button>
                        )}
                        {!p && date !== aujourdhui && (
                          <Button size="sm" variant="outline" onClick={() => ouvrir('manuel', a)} aria-label={`Saisir un pointage pour ${nomComplet(a)}`}>Saisir</Button>
                        )}
                        {p && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => ouvrir('corriger', a)} aria-label={`Corriger le pointage de ${nomComplet(a)}`}>Corriger</Button>
                            <Button size="sm" variant="ghost" onClick={() => ouvrir('annuler', a)} aria-label={`Annuler le pointage de ${nomComplet(a)}`}>Annuler</Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={!!modale}
        titre={modale ? titres[modale.type] : ''}
        description={modale ? `${nomComplet(modale.agent)} · ${libelleJour(date)}` : ''}
        libelleValider={modale?.type === 'annuler' ? "Annuler le pointage" : 'Enregistrer'}
        destructif={modale?.type === 'annuler'}
        enCours={enCoursModale} erreur={erreurModale}
        onFermer={() => { if (!enCoursModale) setModale(null); }} onValider={valider}
      >
        {modale?.type !== 'annuler' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="heure-arrivee" className="text-base">Heure d&apos;arrivée *</Label>
              <Input id="heure-arrivee" type="time" value={arrivee} onChange={(e) => setArrivee(e.target.value)} className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="heure-depart" className="text-base">Heure de départ</Label>
              <Input id="heure-depart" type="time" value={depart} onChange={(e) => setDepart(e.target.value)} className="h-11 text-base" />
            </div>
          </div>
        )}
        {modale?.type === 'annuler' && (
          <p className="text-base">Le pointage de ce jour sera supprimé. L&apos;opération reste tracée dans le journal.</p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="motif" className="text-base">Motif *</Label>
          <Input id="motif" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200}
            placeholder="Ex. : oubli de pointage, erreur de saisie" className="h-11 text-base" />
        </div>
      </ModaleCrud>
    </div>
  );
}
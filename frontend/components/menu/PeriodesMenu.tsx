'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import type { PeriodeMenuLigne } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const VIDE = { nom: '', dateDebut: '', dateFin: '' };

export function PeriodesMenu() {
  const [liste, setListe] = useState<PeriodeMenuLigne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [edition, setEdition] = useState<PeriodeMenuLigne | 'nouvelle' | null>(null);
  const [form, setForm] = useState(VIDE);
  const [aSupprimer, setASupprimer] = useState<PeriodeMenuLigne | null>(null);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    api.get<PeriodeMenuLigne[]>('/menu/periodes').then((l) => { setListe(l); setErreur(null); }).catch((e) => setErreur(messageErreur(e)));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  function ouvrir(p: PeriodeMenuLigne | 'nouvelle') {
    setForm(p === 'nouvelle' ? VIDE : { nom: p.nom, dateDebut: p.dateDebut, dateFin: p.dateFin });
    setErreurModale(null); setEdition(p);
  }

  async function enregistrer() {
    if (form.nom.trim().length < 3) { setErreurModale('Le nom doit contenir au moins 3 caractères.'); return; }
    if (!form.dateDebut || !form.dateFin) { setErreurModale('Indiquez les deux dates.'); return; }
    if (form.dateDebut > form.dateFin) { setErreurModale('La date de début doit précéder la date de fin.'); return; }
    setEnCours(true); setErreurModale(null);
    const corps = { nom: form.nom.trim(), dateDebut: form.dateDebut, dateFin: form.dateFin };
    try {
      if (edition === 'nouvelle') {
        await api.post('/menu/periodes', corps);
        setInfo('Période créée. Vous pouvez maintenant renseigner les menus.');
      } else if (edition) {
        await api.patch(`/menu/periodes/${edition.id}`, corps);
        setInfo('Période modifiée.');
      }
      setEdition(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setEnCours(true); setErreurModale(null);
    try {
      await api.delete(`/menu/periodes/${aSupprimer.id}`);
      setInfo('Période supprimée.');
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end"><Button size="lg" onClick={() => ouvrir('nouvelle')}>Nouvelle période</Button></div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead><TableHead>Du</TableHead><TableHead>Au</TableHead>
              <TableHead>Jours renseignés</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!liste ? null : liste.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucune période. Créez-en une pour saisir les menus.</TableCell></TableRow>
            ) : liste.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nom}</TableCell>
                <TableCell className="whitespace-nowrap">{dateFr(p.dateDebut)}</TableCell>
                <TableCell className="whitespace-nowrap">{dateFr(p.dateFin)}</TableCell>
                <TableCell className="tabular-nums">{p.nbJours}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => ouvrir(p)} aria-label={`Modifier la période ${p.nom}`}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setASupprimer(p); setErreurModale(null); }} aria-label={`Supprimer la période ${p.nom}`}>Supprimer</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={edition !== null} titre={edition === 'nouvelle' ? 'Nouvelle période' : 'Modifier la période'}
        description="Deux périodes ne peuvent pas se chevaucher."
        libelleValider="Enregistrer" enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setEdition(null); }} onValider={enregistrer}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="per-nom" className="text-base">Nom *</Label>
            <Input id="per-nom" maxLength={80} value={form.nom} placeholder="Ex. : Trimestre 1" onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="h-11 text-base" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="per-debut" className="text-base">Du *</Label>
              <Input id="per-debut" type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="per-fin" className="text-base">Au *</Label>
              <Input id="per-fin" type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} className="h-11 text-base" />
            </div>
          </div>
        </div>
      </ModaleCrud>

      <ModaleCrud
        ouvert={!!aSupprimer} titre="Supprimer cette période ?" description={aSupprimer?.nom ?? ''}
        libelleValider="Supprimer" destructif enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setASupprimer(null); }} onValider={supprimer}
      >
        <p className="text-sm text-muted-foreground">
          {aSupprimer && aSupprimer.nbJours > 0
            ? `Les ${aSupprimer.nbJours} menu(s) déjà saisis dans cette période seront aussi supprimés. Cette action est définitive.`
            : 'Cette action est définitive.'}
        </p>
      </ModaleCrud>
    </div>
  );
}
'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateHeure } from '@/lib/audit';
import { aujourdhuiIso } from '@/lib/pointage';
import { LIBELLE_STATUT, VARIANTE_STATUT } from '@/lib/rendez-vous';
import type { OptionsRdv, RdvParent } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const FORM_VIDE = { interlocuteurId: '', date: '', heure: '', motif: '' };

export default function RendezVousParent() {
  const aujourdhui = aujourdhuiIso();
  const [options, setOptions] = useState<OptionsRdv | null>(null);
  const [liste, setListe] = useState<RdvParent[] | null>(null);
  const [form, setForm] = useState(FORM_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [aAnnuler, setAAnnuler] = useState<RdvParent | null>(null);
  const [erreurModale, setErreurModale] = useState<string | null>(null);

  const charger = useCallback(() => {
    api.get<RdvParent[]>('/parent/rendez-vous').then(setListe).catch((e) => setErreur(messageErreur(e)));
  }, []);

  useEffect(() => {
    api.get<OptionsRdv>('/parent/rendez-vous/options').then(setOptions).catch((e) => setErreur(messageErreur(e)));
    charger();
  }, [charger]);

  async function demander(e: FormEvent) {
    e.preventDefault();
    setErreur(null); setInfo(null);
    if (!form.interlocuteurId || !form.date || !form.heure) {
      setErreur('Choisissez la personne, le jour et l\'heure.');
      return;
    }
    const jour = new Date(`${form.date}T00:00:00Z`).getUTCDay();
    if (jour === 0 || jour === 6) {
      setErreur('Les rendez-vous ont lieu du lundi au vendredi.');
      return;
    }
    setEnCours(true);
    try {
      await api.post('/parent/rendez-vous', {
        interlocuteurId: Number(form.interlocuteurId),
        date: form.date,
        heure: form.heure,
        motif: form.motif.trim() || undefined,
      });
      setInfo('Votre demande a été envoyée. Vous serez prévenu(e) dès sa confirmation.');
      setForm(FORM_VIDE);
      charger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  async function annuler() {
    if (!aAnnuler) return;
    setEnCours(true); setErreurModale(null);
    try {
      await api.patch(`/parent/rendez-vous/${aAnnuler.id}/annuler`, {});
      setInfo('Rendez-vous annulé.');
      setAAnnuler(null);
      charger();
    } catch (err) {
      setErreurModale(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">Rendez-vous avec l&apos;école</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Choisissez la personne, le jour et l&apos;heure. L&apos;école confirme ou propose un autre moment.
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      <form onSubmit={demander} className="mb-10 grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rdv-qui" className="text-base">Avec qui ? *</Label>
          <Select value={form.interlocuteurId} onValueChange={(v) => setForm((f) => ({ ...f, interlocuteurId: v }))}>
            <SelectTrigger id="rdv-qui" className="h-11 w-full text-base"><SelectValue placeholder="Choisir une personne" /></SelectTrigger>
            <SelectContent>
              {options?.interlocuteurs.map((i) => (
                <SelectItem key={i.utilisateurId} value={String(i.utilisateurId)}>{i.nom} · {i.fonction}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rdv-jour" className="text-base">Jour * (lundi au vendredi)</Label>
          <Input id="rdv-jour" type="date" min={aujourdhui} value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-11 text-base" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rdv-heure" className="text-base">Heure *</Label>
          <Select value={form.heure} onValueChange={(v) => setForm((f) => ({ ...f, heure: v }))}>
            <SelectTrigger id="rdv-heure" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>
              {options?.creneaux.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rdv-motif" className="text-base">Motif (facultatif)</Label>
          <Input id="rdv-motif" maxLength={300} value={form.motif}
            onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))}
            placeholder="Ex. : point sur les résultats du trimestre" className="h-11 text-base" />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" size="lg" disabled={enCours || !options}>
            {enCours ? 'Envoi...' : 'Envoyer la demande'}
          </Button>
          {options && (
            <p className="mt-2 text-sm text-muted-foreground">
              Créneaux de 30 minutes, de 08:00 à 16:30, au moins {options.delaiMinHeures} h à l&apos;avance.
            </p>
          )}
        </div>
      </form>

      <h2 className="mb-3 text-xl font-semibold">Mes rendez-vous</h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {liste && liste.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Aucun rendez-vous pour le moment.</li>}
        {liste?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{dateHeure(r.dateHeure)} · {r.interlocuteur}</p>
              {r.motif && <p className="text-sm text-muted-foreground">{r.motif}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={VARIANTE_STATUT[r.statut]}>{LIBELLE_STATUT[r.statut]}</Badge>
              {r.peutAnnuler && (
                <Button size="sm" variant="outline" onClick={() => { setAAnnuler(r); setErreurModale(null); }}
                  aria-label={`Annuler le rendez-vous du ${dateHeure(r.dateHeure)}`}>Annuler</Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ModaleCrud
        ouvert={!!aAnnuler} titre="Annuler ce rendez-vous ?"
        description={aAnnuler ? `${dateHeure(aAnnuler.dateHeure)} · ${aAnnuler.interlocuteur}` : ''}
        libelleValider="Annuler le rendez-vous" destructif enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setAAnnuler(null); }} onValider={annuler}
      >
        <p className="text-sm text-muted-foreground">La personne concernée sera prévenue. Vous pourrez refaire une demande ensuite.</p>
      </ModaleCrud>
    </div>
  );
}
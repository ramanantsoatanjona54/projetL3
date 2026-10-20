'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { dateHeure, libelleAction } from '@/lib/audit';
import type { FiltresAudit, LigneAudit, PageAudit } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TOUS = 'tous';
const VIDE = { du: '', au: '', action: '', entite: '', utilisateurId: '', q: '' };
type Filtres = typeof VIDE;

export default function JournalAudit() {
  const { utilisateur } = useAuth();
  const autorise = utilisateur?.role === 'ADMIN' || utilisateur?.role === 'DIRECTRICE';

  const [options, setOptions] = useState<FiltresAudit>({ actions: [], entites: [], utilisateurs: [] });
  const [saisie, setSaisie] = useState<Filtres>(VIDE);
  const [appliques, setAppliques] = useState<Filtres>(VIDE);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<PageAudit | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<LigneAudit | null>(null);

  useEffect(() => {
    if (!autorise) return;
    api.get<FiltresAudit>('/audit/filtres').then(setOptions).catch((e) => setErreur(messageErreur(e)));
  }, [autorise]);

  useEffect(() => {
    if (!autorise) return;
    const p = new URLSearchParams({ page: String(page), taille: '25' });
    (Object.keys(appliques) as (keyof Filtres)[]).forEach((k) => { if (appliques[k]) p.set(k, appliques[k]); });
    setDonnees(null);
    api.get<PageAudit>(`/audit?${p.toString()}`)
      .then((d) => { setDonnees(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [autorise, appliques, page]);

  function appliquer(e: FormEvent) {
    e.preventDefault();
    if (saisie.du && saisie.au && saisie.du > saisie.au) {
      setErreur('La date de début doit précéder la date de fin.');
      return;
    }
    setErreur(null);
    setPage(1);
    setAppliques(saisie);
  }

  function reinitialiser() {
    setSaisie(VIDE);
    setAppliques(VIDE);
    setPage(1);
    setErreur(null);
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administration et à la direction.</AlertDescription></Alert>;
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taille)) : 1;
  const choix = (cle: 'action' | 'entite' | 'utilisateurId', v: string) =>
    setSaisie((s) => ({ ...s, [cle]: v === TOUS ? '' : v }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Journal d&apos;audit</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {donnees ? `${donnees.total} événement(s) trouvé(s). Le journal est en lecture seule.` : 'Chargement...'}
        </p>
      </div>

      <form onSubmit={appliquer} className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="du" className="text-base">Du</Label>
          <Input id="du" type="date" value={saisie.du} onChange={(e) => setSaisie((s) => ({ ...s, du: e.target.value }))} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="au" className="text-base">Au</Label>
          <Input id="au" type="date" value={saisie.au} onChange={(e) => setSaisie((s) => ({ ...s, au: e.target.value }))} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="q" className="text-base">Recherche</Label>
          <Input id="q" value={saisie.q} onChange={(e) => setSaisie((s) => ({ ...s, q: e.target.value }))} placeholder="Action, élément ou numéro" className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-action" className="text-base">Action</Label>
          <Select value={saisie.action || TOUS} onValueChange={(v) => choix('action', v)}>
            <SelectTrigger id="f-action" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Toutes les actions</SelectItem>
              {options.actions.map((a) => <SelectItem key={a} value={a}>{libelleAction(a)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-entite" className="text-base">Élément concerné</Label>
          <Select value={saisie.entite || TOUS} onValueChange={(v) => choix('entite', v)}>
            <SelectTrigger id="f-entite" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les éléments</SelectItem>
              {options.entites.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-user" className="text-base">Utilisateur</Label>
          <Select value={saisie.utilisateurId || TOUS} onValueChange={(v) => choix('utilisateurId', v)}>
            <SelectTrigger id="f-user" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les utilisateurs</SelectItem>
              {options.utilisateurs.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
          <Button type="submit">Appliquer les filtres</Button>
          <Button type="button" variant="ghost" onClick={reinitialiser}>Réinitialiser</Button>
        </div>
      </form>

      {erreur && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreur}</AlertDescription></Alert>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date et heure</TableHead><TableHead>Utilisateur</TableHead><TableHead>Action</TableHead>
              <TableHead>Élément</TableHead><TableHead className="text-right">Détail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : donnees.lignes.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun événement ne correspond à ces filtres.</TableCell></TableRow>
            ) : donnees.lignes.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap tabular-nums">{l.date ? dateHeure(l.date) : '—'}</TableCell>
                <TableCell>{l.utilisateur ? l.utilisateur.email : <span className="text-muted-foreground">Système</span>}</TableCell>
                <TableCell>
                  <span className="font-medium">{libelleAction(l.action)}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{l.action}</span>
                </TableCell>
                <TableCell>{l.entite ? `${l.entite}${l.entiteId ? ` n°${l.entiteId}` : ''}` : '—'}</TableCell>
                <TableCell className="text-right">
                  {l.details != null ? (
                    <Button size="sm" variant="outline" onClick={() => setDetail(l)} aria-label={`Voir le détail de l'événement ${l.id}`}>Voir</Button>
                  ) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Page {page} sur {pages}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail ? libelleAction(detail.action) : ''}</DialogTitle>
            <DialogDescription>
              {detail?.date ? dateHeure(detail.date) : ''} · {detail?.utilisateur?.email ?? 'Système'}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-3 font-mono text-sm">
            {detail ? JSON.stringify(detail.details, null, 2) : ''}
          </pre>
          <DialogFooter><Button onClick={() => setDetail(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import type { LigneAbsence, PageAbsences, SalleSimple } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const TOUS = 'tous';
const VIDE = { salleId: '', du: '', au: '', statut: '', q: '' };
type Filtres = typeof VIDE;

export function SuiviAbsences({ peutJustifier }: { peutJustifier: boolean }) {
  const [salles, setSalles] = useState<SalleSimple[]>([]);
  const [saisie, setSaisie] = useState<Filtres>(VIDE);
  const [appliques, setAppliques] = useState<Filtres>(VIDE);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<PageAbsences | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [cible, setCible] = useState<LigneAbsence | null>(null);
  const [motif, setMotif] = useState('');
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    api.get<SalleSimple[]>('/absences/salles').then(setSalles).catch(() => {});
  }, []);

  const charger = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), taille: '25' });
    (Object.keys(appliques) as (keyof Filtres)[]).forEach((k) => { if (appliques[k]) p.set(k, appliques[k]); });
    api.get<PageAbsences>(`/absences?${p.toString()}`)
      .then((d) => { setDonnees(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [appliques, page]);

  useEffect(() => { setDonnees(null); charger(); }, [charger]);

  function appliquer(e: FormEvent) {
    e.preventDefault();
    if (saisie.du && saisie.au && saisie.du > saisie.au) { setErreur('La date de début doit précéder la date de fin.'); return; }
    setErreur(null); setPage(1); setAppliques(saisie);
  }

  async function justifier() {
    if (!cible) return;
    if (motif.trim().length < 5) { setErreurModale('Indiquez le motif (5 caractères minimum).'); return; }
    setEnCours(true); setErreurModale(null);
    try {
      await api.patch(`/absences/${cible.id}/justifier`, { motif: motif.trim() });
      setInfo(`Absence de ${cible.eleve.prenom} ${cible.eleve.nom} justifiée.`);
      setCible(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function annulerJustification(a: LigneAbsence) {
    setInfo(null);
    try {
      await api.patch(`/absences/${a.id}/annuler-justification`, {});
      setInfo(`Justification de ${a.eleve.prenom} ${a.eleve.nom} annulée.`);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taille)) : 1;

  return (
    <div>
      <form onSubmit={appliquer} className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="s-du" className="text-base">Du (30 derniers jours par défaut)</Label>
          <Input id="s-du" type="date" value={saisie.du} onChange={(e) => setSaisie((s) => ({ ...s, du: e.target.value }))} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-au" className="text-base">Au</Label>
          <Input id="s-au" type="date" value={saisie.au} onChange={(e) => setSaisie((s) => ({ ...s, au: e.target.value }))} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-q" className="text-base">Élève</Label>
          <Input id="s-q" value={saisie.q} onChange={(e) => setSaisie((s) => ({ ...s, q: e.target.value }))} placeholder="Nom, prénom ou matricule" className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-salle" className="text-base">Salle</Label>
          <Select value={saisie.salleId || TOUS} onValueChange={(v) => setSaisie((s) => ({ ...s, salleId: v === TOUS ? '' : v }))}>
            <SelectTrigger id="s-salle" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Toutes les salles</SelectItem>
              {salles.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-statut" className="text-base">Situation</Label>
          <Select value={saisie.statut || TOUS} onValueChange={(v) => setSaisie((s) => ({ ...s, statut: v === TOUS ? '' : v }))}>
            <SelectTrigger id="s-statut" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Toutes</SelectItem>
              <SelectItem value="a-justifier">À justifier</SelectItem>
              <SelectItem value="justifiees">Justifiées</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-3">
          <Button type="submit">Appliquer</Button>
          <Button type="button" variant="ghost" onClick={() => { setSaisie(VIDE); setAppliques(VIDE); setPage(1); }}>Réinitialiser</Button>
        </div>
      </form>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">{donnees ? `${donnees.total} absence(s) trouvée(s)` : 'Chargement...'}</p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Salle</TableHead>
              <TableHead>Situation</TableHead><TableHead>Saisie par</TableHead>
              {peutJustifier && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees ? null : donnees.lignes.length === 0 ? (
              <TableRow><TableCell colSpan={peutJustifier ? 6 : 5} className="py-10 text-center text-muted-foreground">Aucune absence ne correspond.</TableCell></TableRow>
            ) : donnees.lignes.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap">{dateFr(a.date)}</TableCell>
                <TableCell>
                  <span className="font-medium">{a.eleve.prenom} {a.eleve.nom}</span>
                  <span className="block text-sm text-muted-foreground">{a.eleve.matricule}</span>
                </TableCell>
                <TableCell>{a.salle}</TableCell>
                <TableCell>
                  <Badge variant={a.justifiee ? 'secondary' : 'destructive'}>{a.justifiee ? 'Justifiée' : 'À justifier'}</Badge>
                  {a.motif && <span className="block text-sm text-muted-foreground">{a.motif}</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.saisiPar ?? '—'}</TableCell>
                {peutJustifier && (
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {a.justifiee ? (
                        <Button size="sm" variant="ghost" onClick={() => annulerJustification(a)}>Annuler la justification</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setCible(a); setMotif(''); setErreurModale(null); }}
                          aria-label={`Justifier l'absence de ${a.eleve.prenom} ${a.eleve.nom}`}>Justifier</Button>
                      )}
                    </div>
                  </TableCell>
                )}
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

      <ModaleCrud
        ouvert={!!cible} titre="Justifier l'absence"
        description={cible ? `${cible.eleve.prenom} ${cible.eleve.nom} · ${dateFr(cible.date)}` : ''}
        libelleValider="Justifier" enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setCible(null); }} onValider={justifier}
      >
        <div className="space-y-1.5">
          <Label htmlFor="motif-absence" className="text-base">Motif *</Label>
          <Input id="motif-absence" value={motif} maxLength={200} onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : maladie, certificat médical présenté" className="h-11 text-base" />
        </div>
      </ModaleCrud>
    </div>
  );
}
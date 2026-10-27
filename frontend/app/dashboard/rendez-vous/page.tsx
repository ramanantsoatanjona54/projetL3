'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateHeure } from '@/lib/audit';
import { LIBELLE_STATUT, VARIANTE_STATUT } from '@/lib/rendez-vous';
import type { LigneRdv, PageRdv } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const TOUS = 'tous';

export default function RendezVousPersonnel() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ADMIN', 'DIRECTRICE', 'SECRETARIAT', 'ENSEIGNANT'].includes(role);
  const voitTout = role === 'ADMIN' || role === 'DIRECTRICE';

  const [statut, setStatut] = useState('DEMANDE');
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<PageRdv | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [cible, setCible] = useState<LigneRdv | null>(null);
  const [raison, setRaison] = useState('');
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    if (!autorise) return;
    const p = new URLSearchParams({ page: String(page), taille: '25' });
    if (statut !== TOUS) p.set('statut', statut);
    api.get<PageRdv>(`/rendez-vous?${p.toString()}`)
      .then((d) => { setDonnees(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [autorise, page, statut]);

  useEffect(() => { setDonnees(null); charger(); }, [charger]);

  async function agir(r: LigneRdv, action: 'confirmer' | 'terminer', message: string) {
    setInfo(null); setErreur(null);
    try {
      await api.patch(`/rendez-vous/${r.id}/${action}`, {});
      setInfo(message);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
      charger();
    }
  }

  async function annuler() {
    if (!cible) return;
    setEnCours(true); setErreurModale(null);
    try {
      await api.patch(`/rendez-vous/${cible.id}/annuler`, { raison: raison.trim() || undefined });
      setInfo(cible.statut === 'DEMANDE' ? 'Demande refusée. Le parent a été prévenu.' : 'Rendez-vous annulé. Le parent a été prévenu.');
      setCible(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée au personnel de l&apos;école.</AlertDescription></Alert>;
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taille)) : 1;

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Rendez-vous</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {voitTout ? 'Tous les rendez-vous demandés par les parents.' : 'Les rendez-vous qui vous sont adressés.'}
      </p>

      <div className="mb-4 w-56 space-y-1.5">
        <Label htmlFor="rdv-filtre" className="text-base">Situation</Label>
        <Select value={statut} onValueChange={(v) => { setStatut(v); setPage(1); }}>
          <SelectTrigger id="rdv-filtre" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="DEMANDE">En attente</SelectItem>
            <SelectItem value="CONFIRME">Confirmés</SelectItem>
            <SelectItem value="TERMINE">Terminés</SelectItem>
            <SelectItem value="ANNULE">Annulés</SelectItem>
            <SelectItem value={TOUS}>Tous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">{donnees ? `${donnees.total} rendez-vous` : 'Chargement...'}</p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date et heure</TableHead><TableHead>Parent</TableHead>
              {voitTout && <TableHead>Avec</TableHead>}
              <TableHead>Motif</TableHead><TableHead>Situation</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees ? null : donnees.lignes.length === 0 ? (
              <TableRow><TableCell colSpan={voitTout ? 6 : 5} className="py-10 text-center text-muted-foreground">Aucun rendez-vous.</TableCell></TableRow>
            ) : donnees.lignes.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap font-medium">{dateHeure(r.dateHeure)}</TableCell>
                <TableCell>
                  <span className="font-medium">{r.parent.prenom} {r.parent.nom}</span>
                  <span className="block text-sm text-muted-foreground">{r.parent.telephone}</span>
                  {r.enfants.length > 0 && <span className="block text-sm text-muted-foreground">Enfant(s) : {r.enfants.join(', ')}</span>}
                </TableCell>
                {voitTout && <TableCell>{r.interlocuteur}</TableCell>}
                <TableCell className="max-w-64 text-sm">{r.motif ?? '—'}</TableCell>
                <TableCell><Badge variant={VARIANTE_STATUT[r.statut]}>{LIBELLE_STATUT[r.statut]}</Badge></TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {r.statut === 'DEMANDE' && (
                      <>
                        <Button size="sm" onClick={() => agir(r, 'confirmer', 'Rendez-vous confirmé. Le parent a été prévenu.')}
                          aria-label={`Confirmer le rendez-vous de ${r.parent.prenom} ${r.parent.nom}`}>Confirmer</Button>
                        <Button size="sm" variant="outline" onClick={() => { setCible(r); setRaison(''); setErreurModale(null); }}
                          aria-label={`Refuser la demande de ${r.parent.prenom} ${r.parent.nom}`}>Refuser</Button>
                      </>
                    )}
                    {r.statut === 'CONFIRME' && (
                      <>
                        {r.peutTerminer && (
                          <Button size="sm" onClick={() => agir(r, 'terminer', 'Rendez-vous clôturé.')}
                            aria-label={`Clôturer le rendez-vous de ${r.parent.prenom} ${r.parent.nom}`}>Clôturer</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => { setCible(r); setRaison(''); setErreurModale(null); }}
                          aria-label={`Annuler le rendez-vous de ${r.parent.prenom} ${r.parent.nom}`}>Annuler</Button>
                      </>
                    )}
                  </div>
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

      <ModaleCrud
        ouvert={!!cible} titre={cible?.statut === 'DEMANDE' ? 'Refuser la demande' : 'Annuler le rendez-vous'}
        description={cible ? `${cible.parent.prenom} ${cible.parent.nom} · ${dateHeure(cible.dateHeure)}` : ''}
        libelleValider={cible?.statut === 'DEMANDE' ? 'Refuser' : 'Annuler le rendez-vous'} destructif
        enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setCible(null); }} onValider={annuler}
      >
        <div className="space-y-1.5">
          <Label htmlFor="rdv-raison" className="text-base">Motif communiqué au parent (facultatif)</Label>
          <Input id="rdv-raison" maxLength={200} value={raison} onChange={(e) => setRaison(e.target.value)}
            placeholder="Ex. : indisponible ce jour-là, merci de proposer un autre créneau" className="h-11 text-base" />
        </div>
      </ModaleCrud>
    </div>
  );
}
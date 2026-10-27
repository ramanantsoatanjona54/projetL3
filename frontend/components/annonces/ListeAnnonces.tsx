'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import { LIBELLE_TYPE_PUBLICATION, TYPES_PUBLICATION } from '@/lib/communication';
import type { PagePublications, PublicationEcole } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const TOUS = 'tous';
const VIDE = { titre: '', contenu: '', type: 'ANNONCE', portee: 'interne' };

export function ListeAnnonces({ peutGerer, parent = false }: { peutGerer: boolean; parent?: boolean }) {
  const [type, setType] = useState(TOUS);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<PagePublications | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [edition, setEdition] = useState<PublicationEcole | 'nouvelle' | null>(null);
  const [form, setForm] = useState(VIDE);
  const [aSupprimer, setASupprimer] = useState<PublicationEcole | null>(null);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), taille: '10' });
    if (type !== TOUS) p.set('type', type);
    api.get<PagePublications>(`/publications?${p.toString()}`)
      .then((d) => { setDonnees(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [page, type]);

  useEffect(() => { setDonnees(null); charger(); }, [charger]);

  function ouvrirCreation() {
    setForm(VIDE); setErreurModale(null); setEdition('nouvelle');
  }
  function ouvrirEdition(p: PublicationEcole) {
    setForm({ titre: p.titre, contenu: p.contenu, type: p.type, portee: p.visiblePublic ? 'publique' : 'interne' });
    setErreurModale(null); setEdition(p);
  }

  async function enregistrer() {
    if (form.titre.trim().length < 3) { setErreurModale('Le titre doit contenir au moins 3 caractères.'); return; }
    if (form.contenu.trim().length < 10) { setErreurModale('Le message doit contenir au moins 10 caractères.'); return; }
    setEnCours(true); setErreurModale(null);
    const corps = { titre: form.titre.trim(), contenu: form.contenu.trim(), type: form.type, visiblePublic: form.portee === 'publique' };
    try {
      if (edition === 'nouvelle') {
        await api.post('/publications', corps);
        setInfo('Annonce publiée. Les personnes concernées ont été prévenues.');
      } else if (edition) {
        await api.patch(`/publications/${edition.id}`, corps);
        setInfo('Annonce modifiée.');
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
      await api.delete(`/publications/${aSupprimer.id}`);
      setInfo('Annonce supprimée.');
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taille)) : 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-52 space-y-1.5">
          <Label htmlFor="ann-type" className="text-base">Type</Label>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger id="ann-type" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous</SelectItem>
              {TYPES_PUBLICATION.map((t) => <SelectItem key={t} value={t}>{LIBELLE_TYPE_PUBLICATION[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {peutGerer && <Button size="lg" onClick={ouvrirCreation}>Nouvelle annonce</Button>}
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      <ul className="space-y-3">
        {donnees && donnees.lignes.length === 0 && (
          <li className="rounded-lg border border-border bg-card px-4 py-10 text-center text-muted-foreground">Aucune annonce.</li>
        )}
        {donnees?.lignes.map((p) => (
          <li key={p.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={p.type === 'URGENT' ? 'destructive' : 'secondary'}>{LIBELLE_TYPE_PUBLICATION[p.type] ?? p.type}</Badge>
              {!parent && <Badge variant="outline">{p.visiblePublic ? 'Publique (parents inclus)' : 'Interne (personnel)'}</Badge>}
              <span className="text-sm tabular-nums text-muted-foreground">{dateFr(p.date)}</span>
            </div>
            <h2 className="mb-1 text-xl font-semibold">{p.titre}</h2>
            <p className="whitespace-pre-wrap">{p.contenu}</p>
            {peutGerer && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => ouvrirEdition(p)} aria-label={`Modifier l'annonce ${p.titre}`}>Modifier</Button>
                <Button size="sm" variant="ghost" onClick={() => { setASupprimer(p); setErreurModale(null); }} aria-label={`Supprimer l'annonce ${p.titre}`}>Supprimer</Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Page {page} sur {pages}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
        </div>
      </div>

      <ModaleCrud
        ouvert={edition !== null} titre={edition === 'nouvelle' ? 'Nouvelle annonce' : "Modifier l'annonce"}
        description="Une annonce publique est visible des parents ; une annonce interne reste réservée au personnel."
        libelleValider={edition === 'nouvelle' ? 'Publier' : 'Enregistrer'} enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setEdition(null); }} onValider={enregistrer}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-titre" className="text-base">Titre *</Label>
            <Input id="ann-titre" maxLength={120} value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} className="h-11 text-base" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ann-nature" className="text-base">Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger id="ann-nature" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES_PUBLICATION.map((t) => <SelectItem key={t} value={t}>{LIBELLE_TYPE_PUBLICATION[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-portee" className="text-base">Destinataires *</Label>
              <Select value={form.portee} onValueChange={(v) => setForm((f) => ({ ...f, portee: v }))}>
                <SelectTrigger id="ann-portee" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interne">Personnel seulement</SelectItem>
                  <SelectItem value="publique">Tout le monde (parents inclus)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-contenu" className="text-base">Message *</Label>
            <Textarea id="ann-contenu" rows={6} maxLength={5000} value={form.contenu} onChange={(e) => setForm((f) => ({ ...f, contenu: e.target.value }))} className="text-base" />
          </div>
        </div>
      </ModaleCrud>

      <ModaleCrud
        ouvert={!!aSupprimer} titre="Supprimer cette annonce ?" description={aSupprimer?.titre ?? ''}
        libelleValider="Supprimer" destructif enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setASupprimer(null); }} onValider={supprimer}
      >
        <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
      </ModaleCrud>
    </div>
  );
}
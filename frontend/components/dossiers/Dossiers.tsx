'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import {
  EXTENSIONS_ACCEPTEES, TAILLE_MAX_OCTETS, lireErreurHttp, tailleLisible,
} from '@/lib/communication';
import type { DossierLigne, PageDossiers } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const TOUS = 'tous';

export function Dossiers({ peutDeposer }: { peutDeposer: boolean }) {
  const [q, setQ] = useState('');
  const [qAppliquee, setQAppliquee] = useState('');
  const [type, setType] = useState(TOUS);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<PageDossiers | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Catégories que le rôle connecté peut consulter et déposer (fournies par le serveur)
  const [typesAutorises, setTypesAutorises] = useState<string[]>([]);

  const [titre, setTitre] = useState('');
  const [nature, setNature] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [cleInput, setCleInput] = useState(0);
  const [erreurDepot, setErreurDepot] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const refFormulaire = useRef<HTMLFormElement>(null);

  const [aSupprimer, setASupprimer] = useState<DossierLigne | null>(null);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), taille: '15' });
    if (qAppliquee) p.set('q', qAppliquee);
    if (type !== TOUS) p.set('type', type);
    api.get<PageDossiers>(`/dossiers?${p.toString()}`)
      .then((d) => { setDonnees(d); setTypesAutorises(d.typesAutorises ?? []); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [page, qAppliquee, type]);

  useEffect(() => { setDonnees(null); charger(); }, [charger]);

  function choisirFichier(f: File | null) {
    setErreurDepot(null);
    if (f) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!EXTENSIONS_ACCEPTEES.includes(ext)) {
        setErreurDepot('Format non accepté. Formats permis : PDF, Word, Excel, PowerPoint, PNG, JPEG.');
        setFichier(null); setCleInput((c) => c + 1);
        return;
      }
      if (f.size > TAILLE_MAX_OCTETS) {
        setErreurDepot('Fichier trop volumineux (10 Mo maximum).');
        setFichier(null); setCleInput((c) => c + 1);
        return;
      }
      if (!titre.trim()) setTitre(f.name.replace(/\.[^.]+$/, '').slice(0, 120));
    }
    setFichier(f);
  }

  async function deposer(e: FormEvent) {
    e.preventDefault();
    setErreurDepot(null); setInfo(null);
    if (titre.trim().length < 3) { setErreurDepot('Le titre doit contenir au moins 3 caractères.'); return; }
    if (!fichier) { setErreurDepot('Choisissez un fichier.'); return; }
    setEnvoi(true);
    try {
      const fd = new FormData();
      fd.append('titre', titre.trim());
      if (nature) fd.append('type', nature);
      fd.append('fichier', fichier);
      const r = await fetch('/api/dossiers/depot', { method: 'POST', body: fd });
      if (!r.ok) { setErreurDepot(await lireErreurHttp(r)); return; }
      setInfo('Document déposé.');
      setTitre(''); setNature(''); setFichier(null); setCleInput((c) => c + 1);
      // On revient à la liste complète pour que le nouveau document soit visible
      setQ(''); setQAppliquee(''); setType(TOUS);
      setPage(1);
      charger();
    } catch {
      setErreurDepot("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  async function telecharger(d: DossierLigne) {
    setErreur(null);
    try {
      const r = await fetch(`/api/dossiers/${d.id}/fichier`);
      if (!r.ok) { setErreur(await lireErreurHttp(r)); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.nomOriginal ?? d.titre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErreur('Le téléchargement a échoué. Réessayez.');
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setEnCours(true); setErreurModale(null);
    try {
      await api.delete(`/dossiers/${aSupprimer.id}`);
      setInfo('Document supprimé.');
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taille)) : 1;
  const lignes = Array.isArray(donnees?.lignes) ? donnees.lignes : [];

  return (
    <div>
      {peutDeposer && (
        <form ref={refFormulaire} onSubmit={deposer} className="mb-8 grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
          <h2 className="text-xl font-semibold sm:col-span-2">Déposer un document</h2>
          <div className="space-y-1.5">
            <Label htmlFor="dos-titre" className="text-base">Titre *</Label>
            <Input id="dos-titre" maxLength={120} value={titre} onChange={(e) => setTitre(e.target.value)} className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dos-type" className="text-base">Catégorie</Label>
            <Select value={nature} onValueChange={setNature}>
              <SelectTrigger id="dos-type" className="h-11 w-full text-base"><SelectValue placeholder="Choisir (facultatif)" /></SelectTrigger>
              <SelectContent>{typesAutorises.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="dos-fichier" className="text-base">Fichier * (PDF, Word, Excel, PowerPoint, PNG, JPEG · 10 Mo max)</Label>
            <Input
              key={cleInput} id="dos-fichier" type="file" className="h-11 text-base"
              accept={EXTENSIONS_ACCEPTEES.map((e) => `.${e}`).join(',')}
              onChange={(e) => choisirFichier(e.target.files?.[0] ?? null)}
            />
            {fichier && <p className="text-sm text-muted-foreground">{fichier.name} · {tailleLisible(fichier.size)}</p>}
          </div>
          {erreurDepot && <Alert variant="destructive" role="alert" className="sm:col-span-2"><AlertDescription>{erreurDepot}</AlertDescription></Alert>}
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" disabled={envoi}>{envoi ? 'Envoi en cours...' : 'Déposer'}</Button>
          </div>
        </form>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setQAppliquee(q.trim()); }}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="dos-q" className="text-base">Rechercher</Label>
          <Input id="dos-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre ou nom du fichier" className="h-11 w-64 text-base" />
        </div>
        <div className="w-52 space-y-1.5">
          <Label htmlFor="dos-filtre" className="text-base">Catégorie</Label>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger id="dos-filtre" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Toutes</SelectItem>
              {typesAutorises.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">Rechercher</Button>
      </form>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">{donnees ? `${donnees.total} document(s)` : 'Chargement...'}</p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead><TableHead>Catégorie</TableHead><TableHead>Déposé par</TableHead>
              <TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees ? null : lignes.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun document.</TableCell></TableRow>
            ) : lignes.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <span className="font-medium">{d.titre}</span>
                  <span className="block text-sm text-muted-foreground">
                    {d.aFichier ? `${d.nomOriginal} · ${tailleLisible(d.taille)}` : <Badge variant="outline">Sans fichier (ancien dépôt)</Badge>}
                  </span>
                </TableCell>
                <TableCell>{d.type ?? '—'}</TableCell>
                <TableCell className="text-sm">{d.deposePar ?? '—'}</TableCell>
                <TableCell className="whitespace-nowrap">{dateFr(d.date)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {d.aFichier && (
                      <Button size="sm" variant="outline" onClick={() => telecharger(d)} aria-label={`Télécharger ${d.titre}`}>Télécharger</Button>
                    )}
                    {d.peutSupprimer && (
                      <Button size="sm" variant="ghost" onClick={() => { setASupprimer(d); setErreurModale(null); }} aria-label={`Supprimer ${d.titre}`}>Supprimer</Button>
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
        ouvert={!!aSupprimer} titre="Supprimer ce document ?" description={aSupprimer?.titre ?? ''}
        libelleValider="Supprimer" destructif enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setASupprimer(null); }} onValider={supprimer}
      >
        <p className="text-sm text-muted-foreground">Le fichier sera effacé du serveur. Cette action est définitive.</p>
      </ModaleCrud>
    </div>
  );
}
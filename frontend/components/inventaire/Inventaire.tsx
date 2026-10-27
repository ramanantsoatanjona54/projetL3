'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import { LIBELLE_TYPE_ARTICLE, TYPES_ARTICLE } from '@/lib/inventaire';
import type { ArticleInventaire, PageInventaire, TypeArticle } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const TOUS = 'tous';
const FORM_VIDE = { libelle: '', type: 'FOURNITURE' as TypeArticle, quantite: '0' };

interface Props { peutGerer: boolean; peutSupprimer: boolean }

export function Inventaire({ peutGerer, peutSupprimer }: Props) {
  const [q, setQ] = useState('');
  const [qAppliquee, setQAppliquee] = useState('');
  const [type, setType] = useState(TOUS);
  const [rupture, setRupture] = useState(false);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<PageInventaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [edition, setEdition] = useState<ArticleInventaire | 'nouveau' | null>(null);
  const [form, setForm] = useState(FORM_VIDE);
  const [mouv, setMouv] = useState<{ article: ArticleInventaire; sens: 'entree' | 'sortie' } | null>(null);
  const [qte, setQte] = useState('');
  const [motif, setMotif] = useState('');
  const [aSupprimer, setASupprimer] = useState<ArticleInventaire | null>(null);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), taille: '25' });
    if (qAppliquee) p.set('q', qAppliquee);
    if (type !== TOUS) p.set('type', type);
    if (rupture) p.set('rupture', '1');
    api.get<PageInventaire>(`/inventaire?${p.toString()}`)
      .then((d) => { setDonnees(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [page, qAppliquee, type, rupture]);
  useEffect(() => { setDonnees(null); charger(); }, [charger]);

  async function executer(action: () => Promise<unknown>, succes: string, fermer: () => void) {
    setEnCours(true); setErreurModale(null);
    try {
      await action();
      setInfo(succes); fermer(); charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  function enregistrerArticle() {
    const libelle = form.libelle.trim();
    if (libelle.length < 2) { setErreurModale('Le libellé doit contenir au moins 2 caractères.'); return; }
    if (edition === 'nouveau') {
      const quantite = Number(form.quantite);
      if (!Number.isInteger(quantite) || quantite < 0) { setErreurModale('La quantité initiale doit être un entier positif ou nul.'); return; }
      return executer(() => api.post('/inventaire', { libelle, type: form.type, quantite }), 'Article créé.', () => setEdition(null));
    }
    if (edition) {
      return executer(() => api.patch(`/inventaire/${edition.id}`, { libelle, type: form.type }), 'Article modifié.', () => setEdition(null));
    }
  }

  function enregistrerMouvement() {
    if (!mouv) return;
    const quantite = Number(qte);
    if (!Number.isInteger(quantite) || quantite < 1) { setErreurModale('La quantité doit être un entier supérieur ou égal à 1.'); return; }
    if (mouv.sens === 'sortie') {
      if (quantite > mouv.article.quantite) { setErreurModale(`Stock insuffisant : ${mouv.article.quantite} disponible(s).`); return; }
      if (motif.trim().length < 3) { setErreurModale('Indiquez le motif de la sortie (3 caractères minimum).'); return; }
    }
    return executer(
      () => api.post(`/inventaire/${mouv.article.id}/${mouv.sens}`, { quantite, motif: motif.trim() || undefined }),
      mouv.sens === 'entree' ? 'Entrée enregistrée.' : 'Sortie enregistrée.',
      () => setMouv(null),
    );
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taille)) : 1;

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); setQAppliquee(q.trim()); }}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="inv-q" className="text-base">Rechercher</Label>
          <Input id="inv-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Libellé" className="h-11 w-56 text-base" />
        </div>
        <div className="w-48 space-y-1.5">
          <Label htmlFor="inv-type" className="text-base">Catégorie</Label>
          <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
            <SelectTrigger id="inv-type" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Toutes</SelectItem>
              {TYPES_ARTICLE.map((t) => <SelectItem key={t} value={t}>{LIBELLE_TYPE_ARTICLE[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="size-5 accent-primary" checked={rupture} onChange={(e) => { setRupture(e.target.checked); setPage(1); }} />
          Stock épuisé seulement
        </label>
        <Button type="submit">Rechercher</Button>
        {peutGerer && (
          <Button type="button" size="lg" className="ml-auto" onClick={() => { setForm(FORM_VIDE); setErreurModale(null); setEdition('nouveau'); }}>
            Nouvel article
          </Button>
        )}
      </form>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {donnees ? `${donnees.total} article(s)${donnees.enRupture > 0 ? ` · ${donnees.enRupture} en rupture au total` : ''}` : 'Chargement...'}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead><TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Stock</TableHead><TableHead>Dernière mise à jour</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees ? null : donnees.lignes.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun article.</TableCell></TableRow>
            ) : donnees.lignes.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.libelle}</TableCell>
                <TableCell>{LIBELLE_TYPE_ARTICLE[a.type]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.quantite === 0 ? <Badge variant="destructive">Épuisé</Badge> : a.quantite.toLocaleString('fr-FR')}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{dateFr(a.dateMaj)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {peutGerer && (
                      <>
                        <Button size="sm" onClick={() => { setMouv({ article: a, sens: 'entree' }); setQte(''); setMotif(''); setErreurModale(null); }}
                          aria-label={`Entrée de stock : ${a.libelle}`}>Entrée</Button>
                        <Button size="sm" variant="outline" disabled={a.quantite === 0}
                          onClick={() => { setMouv({ article: a, sens: 'sortie' }); setQte(''); setMotif(''); setErreurModale(null); }}
                          aria-label={`Sortie de stock : ${a.libelle}`}>Sortie</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setForm({ libelle: a.libelle, type: a.type, quantite: '0' }); setErreurModale(null); setEdition(a); }}
                          aria-label={`Modifier ${a.libelle}`}>Modifier</Button>
                      </>
                    )}
                    <Link href={`/dashboard/inventaire/${a.id}`} className={buttonVariants({ size: 'sm', variant: 'ghost' })} aria-label={`Historique : ${a.libelle}`}>Historique</Link>
                    {peutSupprimer && a.quantite === 0 && (
                      <Button size="sm" variant="ghost" onClick={() => { setASupprimer(a); setErreurModale(null); }} aria-label={`Supprimer ${a.libelle}`}>Supprimer</Button>
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
        ouvert={edition !== null} titre={edition === 'nouveau' ? 'Nouvel article' : "Modifier l'article"}
        description={edition === 'nouveau' ? 'La quantité initiale est enregistrée comme « Stock initial ».' : 'Le stock se modifie par des entrées et des sorties.'}
        libelleValider="Enregistrer" enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setEdition(null); }} onValider={enregistrerArticle}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="art-libelle" className="text-base">Libellé *</Label>
            <Input id="art-libelle" maxLength={100} value={form.libelle} onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="art-type" className="text-base">Catégorie *</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as TypeArticle }))}>
              <SelectTrigger id="art-type" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES_ARTICLE.map((t) => <SelectItem key={t} value={t}>{LIBELLE_TYPE_ARTICLE[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {edition === 'nouveau' && (
            <div className="space-y-1.5">
              <Label htmlFor="art-qte" className="text-base">Quantité initiale</Label>
              <Input id="art-qte" type="number" inputMode="numeric" min={0} value={form.quantite} onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))} className="h-11 text-base" />
            </div>
          )}
        </div>
      </ModaleCrud>

      <ModaleCrud
        ouvert={!!mouv} titre={mouv?.sens === 'entree' ? 'Entrée de stock' : 'Sortie de stock'}
        description={mouv ? `${mouv.article.libelle} · stock actuel : ${mouv.article.quantite.toLocaleString('fr-FR')}` : ''}
        libelleValider="Enregistrer" enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setMouv(null); }} onValider={enregistrerMouvement}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mv-qte" className="text-base">Quantité *</Label>
            <Input id="mv-qte" type="number" inputMode="numeric" min={1} value={qte} onChange={(e) => setQte(e.target.value)} className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-motif" className="text-base">{mouv?.sens === 'sortie' ? 'Motif *' : 'Motif (facultatif)'}</Label>
            <Input id="mv-motif" maxLength={200} value={motif} onChange={(e) => setMotif(e.target.value)}
              placeholder={mouv?.sens === 'sortie' ? 'Ex. : distribué en classe de 8e' : 'Ex. : achat du trimestre'} className="h-11 text-base" />
          </div>
        </div>
      </ModaleCrud>

      <ModaleCrud
        ouvert={!!aSupprimer} titre="Supprimer cet article ?" description={aSupprimer?.libelle ?? ''}
        libelleValider="Supprimer" destructif enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setASupprimer(null); }}
        onValider={() => aSupprimer && executer(() => api.delete(`/inventaire/${aSupprimer.id}`), 'Article supprimé.', () => setASupprimer(null))}
      >
        <p className="text-sm text-muted-foreground">L&apos;article et son historique seront supprimés. L&apos;opération reste inscrite au journal d&apos;audit.</p>
      </ModaleCrud>
    </div>
  );
}
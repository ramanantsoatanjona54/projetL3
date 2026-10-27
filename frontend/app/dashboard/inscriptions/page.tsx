'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { InscriptionAttente, ResultatValidation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useActualisationAuto } from '@/lib/useActualisationAuto';

// ...

type Action = { type: 'valider' | 'annuler'; item: InscriptionAttente };
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

export default function InscriptionsEnAttente() {
  const [items, setItems] = useState<InscriptionAttente[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatValidation | null>(null);
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const autorise = role === 'SECRETARIAT' || role === 'DIRECTRICE';
  const peutValider = role === 'SECRETARIAT';
  const peutAnnuler = role === 'SECRETARIAT';
  

const charger = useCallback(() => {
    api.get<InscriptionAttente[]>('/inscriptions/en-attente')
      .then((r) => { setItems(r); setErreur(null); })
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useActualisationAuto(charger);

  async function confirmer() {
    if (!action || enCours) return;
    setEnCours(true);
    setErreurAction(null);
    try {
      if (action.type === 'valider') {
        setResultat(await api.patch<ResultatValidation>(`/inscriptions/${action.item.id}/valider`));
      } else {
        await api.patch(`/inscriptions/${action.item.id}/annuler`);
      }
      setAction(null);
      charger();
    } catch (e) {
      setErreurAction(e instanceof ApiError ? e.message : 'Action impossible pour le moment.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Inscriptions en attente</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {items ? `${items.length} dossier(s) à traiter` : 'Chargement...'} · Validez une inscription lorsque le dossier papier a été remis.
      </p>

      {erreur && <Alert variant="destructive"><AlertDescription>{erreur}</AlertDescription></Alert>}

      {items && (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Année</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Salle</TableHead>
                <TableHead>Fratrie</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Aucune inscription en attente.</TableCell>
                </TableRow>
              ) : (
                items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/eleves/${i.eleve.id}`} className="hover:text-primary hover:underline">
                        {i.eleve.nom.toUpperCase()} {i.eleve.prenom}
                      </Link>
                    </TableCell>
                    <TableCell>{i.anneeScolaire?.libelle ?? '—'}</TableCell>
                    <TableCell>{i.niveau.nom}</TableCell>
                    <TableCell>{i.salle.nom}</TableCell>
                    <TableCell>{i.rangFratrie > 1 ? <Badge variant="secondary">{ordinal(i.rangFratrie)} enfant</Badge> : '—'}</TableCell>
                   <TableCell>
  <div className="flex justify-end gap-2">
    <Button asChild size="sm" variant="ghost">
      <Link href={`/dashboard/inscriptions/${i.id}/fiche`}>Fiche</Link>
    </Button>
    {peutAnnuler && (
      <Button size="sm" variant="outline" onClick={() => setAction({ type: 'annuler', item: i })}>
        Annuler
      </Button>
    )}
    {peutValider && (
      <Button size="sm" onClick={() => setAction({ type: 'valider', item: i })}>
        Valider
      </Button>
    )}
  </div>
</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Confirmation */}
      <Dialog open={!!action} onOpenChange={(o) => { if (!o && !enCours) { setAction(null); setErreurAction(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.type === 'valider' ? "Valider l'inscription" : "Annuler l'inscription"}</DialogTitle>
            <DialogDescription>
              {action && `${action.item.eleve.nom.toUpperCase()} ${action.item.eleve.prenom} · ${action.item.niveau.nom} · salle ${action.item.salle.nom}`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-base">
            {action?.type === 'valider'
              ? "Confirmez que le dossier papier a bien été remis à l'école. Des comptes seront créés pour les parents qui n'en ont pas encore."
              : "L'inscription sera annulée. Cette action est enregistrée dans le journal d'audit."}
          </p>
          {erreurAction && <Alert variant="destructive" role="alert"><AlertDescription>{erreurAction}</AlertDescription></Alert>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={enCours}>Retour</Button>
            <Button variant={action?.type === 'annuler' ? 'destructive' : 'default'} onClick={confirmer} disabled={enCours}>
              {enCours ? 'En cours...' : action?.type === 'valider' ? 'Valider' : "Annuler l'inscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Résultat de validation : comptes parents créés */}
      <Dialog open={!!resultat} onOpenChange={(o) => { if (!o) setResultat(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inscription validée</DialogTitle>
            <DialogDescription>
              {resultat && resultat.comptesGeneresPourParents.length > 0
                ? 'Comptes parents créés. Ces mots de passe ne seront plus jamais affichés : transmettez-les maintenant, de façon sécurisée.'
                : 'Aucun nouveau compte parent créé (comptes déjà existants, ou aucun email renseigné).'}
            </DialogDescription>
          </DialogHeader>
          {resultat?.comptesGeneresPourParents.map((c) => (
            <div key={c.email} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm text-muted-foreground">{c.email}</p>
                <p className="font-mono text-base">{c.motDePasseTemporaire}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(`${c.email} / ${c.motDePasseTemporaire}`)}>
                Copier
              </Button>
            </div>
          ))}
          {resultat && resultat.parentsSansEmail > 0 && (
            <p className="text-sm text-muted-foreground">
              {resultat.parentsSansEmail} parent(s) sans adresse email : aucun compte n&apos;a pu leur être créé. Renseignez leur email pour qu&apos;ils accèdent à leur espace.
            </p>
          )}
          <DialogFooter><Button onClick={() => setResultat(null)}>Terminé</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
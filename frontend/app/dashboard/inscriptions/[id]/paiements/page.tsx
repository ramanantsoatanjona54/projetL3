'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext'; // adaptez le nom exact exporté
import { ar, dateFr, nomMois } from '@/lib/format';
import type { SituationPaiement, Echeance, PaiementLigne } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Cible =
  | { type: 'mois'; e: Echeance }
  | { type: 'annuel' }
  | { type: 'annuler'; p: PaiementLigne };

const STATUT_ECHEANCE = {
  paye: { label: 'Payé', variant: 'default' },
  en_retard: { label: 'En retard', variant: 'destructive' },
  du: { label: 'À régler', variant: 'secondary' },
  a_venir: { label: 'À venir', variant: 'outline' },
} as const;

function Chiffre({ titre, valeur, alerte }: { titre: string; valeur: string; alerte?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{titre}</p>
        <p className={`mt-1 text-2xl font-semibold ${alerte ? 'text-destructive' : ''}`}>{valeur}</p>
      </CardContent>
    </Card>
  );
}

export default function PaiementsInscription() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const peutEncaisser = role === 'ADMIN' || role === 'COMPTABLE' || role === 'DIRECTRICE';
  const peutAnnuler = role === 'ADMIN' || role === 'COMPTABLE';

  const [s, setS] = useState<SituationPaiement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cible, setCible] = useState<Cible | null>(null);
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const charger = useCallback(() => {
    api.get<SituationPaiement>(`/finances/inscriptions/${id}/situation`)
      .then(setS)
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  }, [id]);

  useEffect(() => { charger(); }, [charger]);

  function fermer() { if (!enCours) { setCible(null); setMotif(''); setErreurAction(null); } }

  async function confirmer() {
    if (!cible || enCours) return;
    if (cible.type === 'annuler' && motif.trim().length < 5) {
      setErreurAction('Indiquez le motif (5 caractères minimum).');
      return;
    }
    setEnCours(true);
    setErreurAction(null);
    try {
      if (cible.type === 'annuler') {
        await api.patch(`/finances/paiements/${cible.p.id}/annuler`, { motif: motif.trim() });
        setCible(null); setMotif(''); charger();
      } else {
        const body = cible.type === 'mois'
          ? { inscriptionId: Number(id), mode: 'MENSUEL', moisConcerne: cible.e.mois }
          : { inscriptionId: Number(id), mode: 'GLOBAL_ANNUEL' };
        const p = await api.post<{ id: number }>('/finances/paiements', body);
        router.push(`/dashboard/inscriptions/${id}/paiements/${p.id}/recu`); // ouvre directement le reçu
        return;
      }
    } catch (e) {
      setErreurAction(e instanceof ApiError ? e.message : 'Action impossible pour le moment.');
      charger(); // l'état a peut-être changé (ex. déjà payé par un collègue)
    } finally {
      setEnCours(false);
    }
  }

  if (erreur) return <Alert variant="destructive"><AlertDescription>{erreur}</AlertDescription></Alert>;
  if (!s) return <p className="text-muted-foreground">Chargement...</p>;

  const { eleve } = s.inscription;
  const aucunPaiementActif = !s.paiements.some((p) => p.statut === 'paye');
  const nbRetards = s.echeances.filter((e) => e.statut === 'en_retard').length;

  return (
    <div>
      <Link href={`/dashboard/eleves/${eleve.id}`} className="text-sm text-muted-foreground hover:text-primary">← Fiche de l&apos;élève</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">Écolage de {eleve.prenom} {eleve.nom.toUpperCase()}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {s.inscription.anneeScolaire.libelle} · {s.inscription.niveau.nom} · salle {s.inscription.salle.nom} ·{' '}
        {s.inscription.rangFratrie === 1 ? '1er enfant' : `${s.inscription.rangFratrie}e enfant`} · {ar(s.montantMensuel)} / mois
      </p>

      {s.inscription.statut !== 'validee' && (
        <Alert role="alert" className="mb-6">
          <AlertDescription>Cette inscription n&apos;est pas validée : aucun paiement ne peut être enregistré.</AlertDescription>
        </Alert>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Chiffre titre="Total de l'année" valeur={ar(s.totalAnnuel)} />
        <Chiffre titre="Déjà payé" valeur={ar(s.totalPaye)} />
        <Chiffre titre="Reste à payer" valeur={ar(s.resteAPayer)} alerte={nbRetards > 0} />
        <Chiffre titre="Pénalités en cours" valeur={ar(s.penalitesEnCours)} alerte={s.penalitesEnCours > 0} />
      </div>

      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Échéancier</CardTitle>
          {peutEncaisser && s.inscription.statut === 'validee' && aucunPaiementActif && (
            <Button variant="outline" onClick={() => setCible({ type: 'annuel' })}>
              Payer l&apos;année entière ({ar(s.totalAnnuel)})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead><TableHead>Montant</TableHead><TableHead>Pénalité</TableHead>
                <TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.echeances.map((e) => {
                const st = STATUT_ECHEANCE[e.statut];
                return (
                  <TableRow key={e.mois}>
                    <TableCell className="font-medium capitalize">{nomMois(e.datePrevue)}</TableCell>
                    <TableCell>{ar(e.montant)}</TableCell>
                    <TableCell>{e.penalite > 0 ? ar(e.penalite) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {e.joursRetard > 0 && <span className="ml-2 text-sm text-muted-foreground">{e.joursRetard} j</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {peutEncaisser && s.inscription.statut === 'validee' && e.statut !== 'paye' && !s.annuelPaye && (
                        <Button size="sm" onClick={() => setCible({ type: 'mois', e })}>Encaisser</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique des paiements</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Objet</TableHead><TableHead>Montant</TableHead>
                <TableHead>Reçu</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.paiements.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucun paiement enregistré.</TableCell></TableRow>
              ) : s.paiements.map((p) => (
                <TableRow key={p.id} className={p.statut === 'annule' ? 'text-muted-foreground' : ''}>
                  <TableCell>{dateFr(p.dateEffective)}</TableCell>
                  <TableCell>
                    {p.mode === 'GLOBAL_ANNUEL' ? 'Année entière'
                      : nomMois(s.echeances.find((e) => e.mois === p.moisConcerne)?.datePrevue ?? new Date().toISOString())}
                  </TableCell>
                  <TableCell>
                    {ar(Number(p.montant) + Number(p.montantPenalite))}
                    {Number(p.montantPenalite) > 0 && <span className="block text-sm text-muted-foreground">dont {ar(p.montantPenalite)} de pénalité</span>}
                  </TableCell>
                  <TableCell>
                    {p.numeroRecu && (
                      <Link href={`/dashboard/inscriptions/${id}/paiements/${p.id}/recu`} className="hover:text-primary hover:underline">{p.numeroRecu}</Link>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.statut === 'annule'
                      ? <Badge variant="destructive" title={p.motifAnnulation ?? ''}>Annulé</Badge>
                      : <Badge>Enregistré</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {peutAnnuler && p.statut === 'paye' && (
                      <Button size="sm" variant="outline" onClick={() => setCible({ type: 'annuler', p })}>Annuler</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!cible} onOpenChange={(o) => { if (!o) fermer(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cible?.type === 'annuler' ? 'Annuler ce paiement' : cible?.type === 'annuel' ? "Encaisser l'année entière" : 'Encaisser la mensualité'}
            </DialogTitle>
            <DialogDescription>{eleve.prenom} {eleve.nom.toUpperCase()}</DialogDescription>
          </DialogHeader>

          {cible?.type === 'mois' && (
            <div className="space-y-1 text-base">
              <p className="capitalize">{nomMois(cible.e.datePrevue)} : {ar(cible.e.montant)}</p>
              {cible.e.penalite > 0 && <p className="text-destructive">Pénalité de retard ({cible.e.joursRetard} jours) : {ar(cible.e.penalite)}</p>}
              <p className="pt-2 text-lg font-semibold">Total à encaisser : {ar(cible.e.montant + cible.e.penalite)}</p>
            </div>
          )}
          {cible?.type === 'annuel' && (
            <p className="text-lg font-semibold">Total à encaisser : {ar(s.totalAnnuel)}</p>
          )}
          {cible?.type === 'annuler' && (
            <div className="space-y-2">
              <p className="text-base">Reçu {cible.p.numeroRecu} : le mois redeviendra dû. L&apos;action est enregistrée dans le journal.</p>
              <Label htmlFor="motif" className="text-base">Motif de l&apos;annulation *</Label>
              <Textarea id="motif" value={motif} onChange={(ev) => setMotif(ev.target.value)} maxLength={200} aria-invalid={!!erreurAction} />
            </div>
          )}

          {erreurAction && <Alert variant="destructive" role="alert"><AlertDescription>{erreurAction}</AlertDescription></Alert>}
          <DialogFooter>
            <Button variant="outline" onClick={fermer} disabled={enCours}>Retour</Button>
            <Button variant={cible?.type === 'annuler' ? 'destructive' : 'default'} onClick={confirmer} disabled={enCours}>
              {enCours ? 'En cours...' : cible?.type === 'annuler' ? "Annuler le paiement" : 'Confirmer l\'encaissement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
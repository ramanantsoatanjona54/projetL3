'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import { normaliser } from '@/lib/normaliser';
import { libelleSalle, nomComplet } from '@/lib/personnel';
import type { PersonnelLigne } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const TOUS = 'tous';
const EN_POSTE = 'en-poste';
const PARTIS = 'partis';

export default function Personnel() {
  const { utilisateur } = useAuth();
  const admin = utilisateur?.role === 'ADMIN';
  const autorise = admin || utilisateur?.role === 'COMPTABLE' || utilisateur?.role === 'DIRECTRICE';

  const [liste, setListe] = useState<PersonnelLigne[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreurPage, setErreurPage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtrePoste, setFiltrePoste] = useState(TOUS);
  const [filtreStatut, setFiltreStatut] = useState(EN_POSTE);

  const [cible, setCible] = useState<PersonnelLigne | null>(null);
  const [dateDepart, setDateDepart] = useState('');
  const [desactiver, setDesactiver] = useState(true);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    api.get<PersonnelLigne[]>('/rh/personnel')
      .then((l) => { setListe(l); setErreurPage(null); setCharge(true); })
      .catch((e) => setErreurPage(messageErreur(e)));
  }, []);

  useEffect(() => { if (autorise) charger(); }, [autorise, charger]);

  const postes = useMemo(() => Array.from(new Set(liste.map((p) => p.poste))).sort(), [liste]);
  const enPoste = liste.filter((p) => !p.dateDepart).length;

  const affiches = useMemo(() => {
    const q = normaliser(recherche);
    return liste.filter((p) =>
      (filtrePoste === TOUS || p.poste === filtrePoste) &&
      (filtreStatut === TOUS || (filtreStatut === EN_POSTE ? !p.dateDepart : !!p.dateDepart)) &&
      (!q || normaliser(`${p.nom} ${p.prenom} ${p.matricule} ${p.poste}`).includes(q)),
    );
  }, [liste, recherche, filtrePoste, filtreStatut]);

  function ouvrirDepart(p: PersonnelLigne) {
    setCible(p);
    setDateDepart(new Date().toISOString().slice(0, 10));
    setDesactiver(true);
    setErreurModale(null);
  }

  async function enregistrerDepart() {
    if (!cible) return;
    if (!dateDepart) { setErreurModale('Saisissez la date de départ.'); return; }
    setEnCours(true);
    setErreurModale(null);
    try {
      const r = await api.post<{ compteDesactive: boolean }>(`/rh/personnel/${cible.id}/depart`, {
        dateDepart, desactiverCompte: desactiver,
      });
      setInfo(`Départ de ${nomComplet(cible)} enregistré.${r.compteDesactive ? ' Son compte a été désactivé.' : ''}`);
      setCible(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administration.</AlertDescription></Alert>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Personnel</h1>
          <p className="text-sm text-muted-foreground">
            {charge ? `${affiches.length} fiche(s) affichée(s) · ${enPoste} en poste sur ${liste.length}` : 'Chargement...'}
          </p>
        </div>
        {admin && <Link href="/dashboard/personnel/nouveau" className={buttonVariants({})}>Nouvelle fiche</Link>}
      </div>

      {info && <Alert role="status" className="mb-6"><AlertDescription>{info}</AlertDescription></Alert>}
      {erreurPage && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreurPage}</AlertDescription></Alert>}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="recherche" className="text-base">Rechercher</Label>
          <Input id="recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, matricule, poste" className="h-11 text-base" />
        </div>
        <div className="w-52 space-y-1.5">
          <Label htmlFor="filtre-poste" className="text-base">Poste</Label>
          <Select value={filtrePoste} onValueChange={setFiltrePoste}>
            <SelectTrigger id="filtre-poste" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les postes</SelectItem>
              {postes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48 space-y-1.5">
          <Label htmlFor="filtre-statut" className="text-base">Situation</Label>
          <Select value={filtreStatut} onValueChange={setFiltreStatut}>
            <SelectTrigger id="filtre-statut" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={EN_POSTE}>En poste</SelectItem>
              <SelectItem value={PARTIS}>Partis</SelectItem>
              <SelectItem value={TOUS}>Tous</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead><TableHead>Poste</TableHead><TableHead>Contact</TableHead>
              <TableHead>Embauche</TableHead><TableHead>Compte</TableHead>
              {admin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {affiches.length === 0 ? (
              <TableRow><TableCell colSpan={admin ? 6 : 5} className="py-10 text-center text-muted-foreground">Aucune fiche ne correspond.</TableCell></TableRow>
            ) : affiches.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-medium">{nomComplet(p)}</span>
                  <span className="block text-sm text-muted-foreground">{p.matricule}</span>
                </TableCell>
                <TableCell>
                  {p.poste}
                  {p.salleAffectee && <span className="block text-sm text-muted-foreground">{libelleSalle(p.salleAffectee)}</span>}
                </TableCell>
                <TableCell>{p.telephone ?? <span className="text-muted-foreground">Non renseigné</span>}</TableCell>
                <TableCell>
                  {dateFr(p.dateEmbauche)}
                  {p.dateDepart && <span className="block"><Badge variant="secondary">Parti le {dateFr(p.dateDepart)}</Badge></span>}
                </TableCell>
                <TableCell>
                  {p.utilisateur
                    ? <Badge variant={p.utilisateur.actif ? 'default' : 'secondary'}>{p.utilisateur.actif ? 'Compte actif' : 'Compte désactivé'}</Badge>
                    : <Badge variant="outline">Pas de compte</Badge>}
                </TableCell>
                {admin && (
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/dashboard/personnel/${p.id}/modifier`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Modifier</Link>
                      {!p.utilisateur && !p.dateDepart && (
                        <Link href="/dashboard/utilisateurs" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Créer un compte</Link>
                      )}
                      {!p.dateDepart && <Button size="sm" variant="ghost" onClick={() => ouvrirDepart(p)}>Enregistrer le départ</Button>}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={!!cible}
        titre="Enregistrer un départ"
        description={cible ? nomComplet(cible) : ''}
        libelleValider="Enregistrer le départ"
        enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setCible(null); }} onValider={enregistrerDepart}
      >
        <div className="space-y-1.5">
          <Label htmlFor="date-depart" className="text-base">Date de départ *</Label>
          <Input id="date-depart" type="date" value={dateDepart} onChange={(e) => setDateDepart(e.target.value)} className="h-11 text-base" />
        </div>
        {cible?.utilisateur?.actif && (
          <label className="flex min-h-11 items-center gap-2 text-base">
            <input type="checkbox" className="size-5 accent-primary" checked={desactiver} onChange={(e) => setDesactiver(e.target.checked)} />
            Désactiver aussi son compte ({cible.utilisateur.email})
          </label>
        )}
      </ModaleCrud>
    </div>
  );
}
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext'; // adaptez le nom exact exporté
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import { normaliser } from '@/lib/normaliser';
import type { PersonnelOption, UtilisateurLigne } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { ChampTexte } from '@/components/structure/ChampTexte';

type Modale = { type: 'creer' } | { type: 'modifier'; u: UtilisateurLigne } | { type: 'reinitialiser'; u: UtilisateurLigne } | null;
interface Resultat { titre: string; email: string; motDePasse: string }

const ROLES: Record<string, string> = {
  ADMIN: 'Administrateur', DIRECTRICE: 'Directrice', SECRETARIAT: 'Secrétariat', COMPTABLE: 'Comptable', PARENT: 'Parent',
};
const libRole = (r: string) => ROLES[r] ?? r.charAt(0) + r.slice(1).toLowerCase();
const nomPersonnel = (p: PersonnelOption) => [p.prenom, p.nom].filter(Boolean).join(' ') || `Personnel #${p.id}`;
const AUCUN = 'aucun';
const TOUS = 'tous';

function statut(u: UtilisateurLigne) {
  if (!u.actif) return { label: 'Désactivé', variant: 'secondary' as const };
  if (u.verrouilleJusqua && new Date(u.verrouilleJusqua) > new Date()) return { label: 'Verrouillé', variant: 'destructive' as const };
  return { label: 'Actif', variant: 'default' as const };
}

export default function Utilisateurs() {
  const { utilisateur } = useAuth();
  const [liste, setListe] = useState<UtilisateurLigne[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelOption[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreurPage, setErreurPage] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState(TOUS);

  const [modale, setModale] = useState<Modale>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [personnelId, setPersonnelId] = useState(AUCUN);
  const [actif, setActif] = useState(true);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  const charger = useCallback(() => {
    Promise.all([
      api.get<UtilisateurLigne[]>('/utilisateurs'),
      api.get<string[]>('/utilisateurs/roles'),
      api.get<PersonnelOption[]>('/utilisateurs/personnel-disponible'),
    ])
      .then(([u, r, p]) => { setListe(u); setRoles(r); setPersonnel(p); setErreurPage(null); setCharge(true); })
      .catch((e) => setErreurPage(messageErreur(e)));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const affiches = useMemo(() => {
    const q = normaliser(recherche);
    return liste.filter((u) =>
      (filtreRole === TOUS || u.role === filtreRole) &&
      (!q || normaliser(u.email).includes(q) ||
        normaliser(u.personnel ? nomPersonnel(u.personnel) : u.parent ? `${u.parent.prenom} ${u.parent.nom}` : '').includes(q)),
    );
  }, [liste, recherche, filtreRole]);

  function ouvrir(m: Modale) {
    setErreurs({});
    setErreur(null);
    if (m?.type === 'modifier') { setEmail(m.u.email); setRole(m.u.role); setActif(m.u.actif); }
    else { setEmail(''); setRole(''); setActif(true); setPersonnelId(AUCUN); }
    setModale(m);
  }

  function valider() {
    const e: Record<string, string> = {};
    const idCourant = modale?.type === 'modifier' ? modale.u.id : null;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Saisissez une adresse email valide.';
    else if (liste.some((u) => u.id !== idCourant && normaliser(u.email) === normaliser(email))) e.email = 'Un compte existe déjà avec cet email.';
    if (!role) e.role = 'Choisissez le rôle.';
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function envoyer() {
    if (!modale) return;
    if (modale.type !== 'reinitialiser' && !valider()) return;
    setEnCours(true);
    setErreur(null);
    try {
      if (modale.type === 'creer') {
        const r = await api.post<{ utilisateur: { email: string }; motDePasseTemporaire: string }>('/utilisateurs', {
          email: email.trim(), role, ...(personnelId !== AUCUN ? { personnelId: Number(personnelId) } : {}),
        });
        setResultat({ titre: 'Compte créé', email: r.utilisateur.email, motDePasse: r.motDePasseTemporaire });
      } else if (modale.type === 'modifier') {
        const u = modale.u;
        const body: Record<string, unknown> = {};
        if (u.role !== 'PARENT') {
          if (email.trim() !== u.email) body.email = email.trim();
          if (role !== u.role) body.role = role;
        }
        if (actif !== u.actif) body.actif = actif;
        if (Object.keys(body).length) await api.patch(`/utilisateurs/${u.id}`, body);
      } else {
        const r = await api.post<{ email: string; motDePasseTemporaire: string }>(
          `/utilisateurs/${modale.u.id}/reinitialiser-mot-de-passe`, {},
        );
        setResultat({ titre: 'Mot de passe réinitialisé', email: r.email, motDePasse: r.motDePasseTemporaire });
      }
      setModale(null);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function deverrouiller(u: UtilisateurLigne) {
    try {
      await api.post(`/utilisateurs/${u.id}/deverrouiller`, {});
      charger();
    } catch (e) {
      setErreurPage(messageErreur(e));
    }
  }

  if (utilisateur && utilisateur.role !== 'ADMIN') {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administrateur.</AlertDescription></Alert>;
  }

  const moi = modale?.type === 'modifier' && modale.u.id === utilisateur?.id;
  const parent = modale?.type === 'modifier' && modale.u.role === 'PARENT';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">{charge ? `${affiches.length} compte(s) affiché(s) sur ${liste.length}` : 'Chargement...'}</p>
        </div>
        <Button onClick={() => ouvrir({ type: 'creer' })}>Nouveau compte</Button>
      </div>

      {erreurPage && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreurPage}</AlertDescription></Alert>}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="recherche" className="text-base">Rechercher</Label>
          <Input id="recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Email ou nom" className="h-11 text-base" />
        </div>
        <div className="w-56 space-y-1.5">
          <Label htmlFor="filtre-role" className="text-base">Rôle</Label>
          <Select value={filtreRole} onValueChange={setFiltreRole}>
            <SelectTrigger id="filtre-role" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les rôles</SelectItem>
              {roles.map((r) => <SelectItem key={r} value={r}>{libRole(r)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {affiches.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun compte ne correspond.</TableCell></TableRow>
            ) : affiches.map((u) => {
              const s = statut(u);
              const verrouille = s.label === 'Verrouillé';
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="font-medium">{u.email}</span>
                    <span className="block text-sm text-muted-foreground">
                      {u.personnel ? nomPersonnel(u.personnel) : u.parent ? `Parent : ${u.parent.prenom} ${u.parent.nom}` : 'Non rattaché'}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline">{libRole(u.role)}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={s.variant}>{s.label}</Badge>
                    {u.doitChangerMotDePasse && <span className="block text-sm text-muted-foreground">Mot de passe temporaire</span>}
                  </TableCell>
                  <TableCell>{u.derniereConnexion ? dateFr(u.derniereConnexion) : 'Jamais'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {verrouille && <Button size="sm" onClick={() => deverrouiller(u)}>Déverrouiller</Button>}
                      <Button size="sm" variant="outline" onClick={() => ouvrir({ type: 'modifier', u })}>Modifier</Button>
                      {u.id !== utilisateur?.id && (
                        <Button size="sm" variant="ghost" onClick={() => ouvrir({ type: 'reinitialiser', u })}>Réinitialiser le mot de passe</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={!!modale}
        titre={modale?.type === 'creer' ? 'Nouveau compte' : modale?.type === 'modifier' ? 'Modifier le compte' : 'Réinitialiser le mot de passe'}
        description={modale?.type === 'creer' ? 'Un mot de passe temporaire sera généré et affiché une seule fois.' : modale?.type === 'modifier' ? modale.u.email : 'Un nouveau mot de passe temporaire sera généré.'}
        libelleValider={modale?.type === 'reinitialiser' ? 'Réinitialiser' : 'Enregistrer'}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setModale(null); }} onValider={envoyer}
      >
        {modale?.type === 'reinitialiser' ? (
          <p className="text-base">
            L&apos;ancien mot de passe de <strong>{modale.u.email}</strong> ne fonctionnera plus. La personne devra en choisir un nouveau à sa prochaine connexion, et le compte sera déverrouillé.
          </p>
        ) : (
          <>
            <ChampTexte id="u-email" label="Email *" type="email" value={email} onChange={setEmail} erreur={erreurs.email}
              aide={parent ? "L'email d'un compte parent ne se modifie pas ici." : undefined} />
            {/* le champ email d'un compte parent reste en lecture seule côté serveur ; on évite de le proposer à la modification */}
            <div className="space-y-1.5">
              <Label htmlFor="u-role" className="text-base">Rôle *</Label>
              <Select value={role} onValueChange={(v) => { setRole(v); setErreurs((p) => ({ ...p, role: '' })); }} disabled={parent || moi}>
                <SelectTrigger id="u-role" className="h-11 w-full text-base" aria-invalid={!!erreurs.role}><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {roles.filter((r) => r !== 'PARENT' || parent).map((r) => <SelectItem key={r} value={r}>{libRole(r)}</SelectItem>)}
                </SelectContent>
              </Select>
              {(parent || moi) && <p className="text-sm text-muted-foreground">{parent ? 'Le rôle Parent ne change pas.' : 'Vous ne pouvez pas changer votre propre rôle.'}</p>}
              {erreurs.role && <p className="text-sm text-destructive">{erreurs.role}</p>}
            </div>
            {modale?.type === 'creer' && (
              <div className="space-y-1.5">
                <Label htmlFor="u-personnel" className="text-base">Rattacher à un membre du personnel</Label>
                <Select value={personnelId} onValueChange={setPersonnelId}>
                  <SelectTrigger id="u-personnel" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUCUN}>Aucun</SelectItem>
                    {personnel.map((p) => <SelectItem key={p.id} value={String(p.id)}>{nomPersonnel(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {modale?.type === 'modifier' && (
              <label className="flex min-h-11 items-center gap-2 text-base">
                <input type="checkbox" className="size-5 accent-primary" checked={actif} disabled={moi} onChange={(e) => setActif(e.target.checked)} />
                Compte actif {moi && <span className="text-sm text-muted-foreground">(vous ne pouvez pas désactiver votre compte)</span>}
              </label>
            )}
          </>
        )}
      </ModaleCrud>

      <Dialog open={!!resultat} onOpenChange={(o) => { if (!o) setResultat(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{resultat?.titre}</DialogTitle>
            <DialogDescription>Ce mot de passe ne sera plus jamais affiché. Transmettez-le de façon sécurisée : la personne devra le changer à sa première connexion.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-sm text-muted-foreground">{resultat?.email}</p>
              <p className="font-mono text-lg">{resultat?.motDePasse}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(`${resultat?.email} / ${resultat?.motDePasse}`)}>Copier</Button>
          </div>
          <DialogFooter><Button onClick={() => setResultat(null)}>Terminé</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
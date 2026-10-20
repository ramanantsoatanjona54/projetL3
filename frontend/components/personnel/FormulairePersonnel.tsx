'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { normaliser } from '@/lib/normaliser';
import { cinNormalise, jourIso, libelleSalle, nomComplet } from '@/lib/personnel';
import type { PersonnelLigne, Salle } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUCUN = 'aucun';

interface Valeurs {
  nom: string; prenom: string; sexe: string; dateNaissance: string; cin: string; telephone: string;
  adresse: string; poste: string; salle: string; lieuAffectation: string; autorisationEnseigner: boolean;
  dateEmbauche: string; dateRetraite: string; dateDepart: string; numeroCnaps: string; banque: string;
  indemnite: string;
}
type CleTexte = Exclude<keyof Valeurs, 'autorisationEnseigner'>;

function depuis(p?: PersonnelLigne): Valeurs {
  return {
    nom: p?.nom ?? '', prenom: p?.prenom ?? '', sexe: p?.sexe ?? AUCUN,
    dateNaissance: jourIso(p?.dateNaissance), cin: p?.cin ?? '', telephone: p?.telephone ?? '',
    adresse: p?.adresse ?? '', poste: p?.poste ?? '',
    salle: p?.salleAffecteeId ? String(p.salleAffecteeId) : AUCUN,
    lieuAffectation: p?.lieuAffectation ?? '', autorisationEnseigner: p?.autorisationEnseigner ?? false,
    dateEmbauche: jourIso(p?.dateEmbauche), dateRetraite: jourIso(p?.dateRetraite),
    dateDepart: jourIso(p?.dateDepart), numeroCnaps: p?.numeroCnaps ?? '', banque: p?.banque ?? '',
    indemnite: p?.indemniteTransportJour != null ? String(Number(p.indemniteTransportJour)) : '',
  };
}

function Champ({ id, label, requis, erreur, avert, aide, children }: {
  id: string; label: string; requis?: boolean; erreur?: string; avert?: string; aide?: string; children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-base">{label}{requis && ' *'}</Label>
      {children}
      <div id={`${id}-msg`} className="space-y-0.5 text-sm">
        {aide && <p className="text-muted-foreground">{aide}</p>}
        {avert && <p className="text-foreground"><strong>Attention : </strong>{avert}</p>}
        {erreur && <p className="text-destructive">{erreur}</p>}
      </div>
    </div>
  );
}

export function FormulairePersonnel({ personnel }: { personnel?: PersonnelLigne }) {
  const router = useRouter();
  const { utilisateur } = useAuth();
  const edition = !!personnel;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [v, setV] = useState<Valeurs>(() => depuis(personnel));
  const [postes, setPostes] = useState<string[]>([]);
  const [salles, setSalles] = useState<Salle[]>([]);
  const [autres, setAutres] = useState<PersonnelLigne[]>([]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<string[]>('/rh/postes'),
      api.get<Salle[]>('/structure/salles'),
      api.get<PersonnelLigne[]>('/rh/personnel'),
    ])
      .then(([p, s, l]) => { setPostes(p); setSalles(s); setAutres(l.filter((x) => x.id !== personnel?.id)); })
      .catch((e) => setErreurGenerale(messageErreur(e)));
  }, [personnel?.id]);

  const setTexte = (k: CleTexte, val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    setErreurs((p) => ({ ...p, [k]: '' }));
  };

  // Ancien poste saisi librement : conservé, mais on invite à choisir dans la liste
  const posteAncien = postes.length > 0 && !!v.poste && !postes.includes(v.poste);
  const optionsPostes = posteAncien ? [v.poste, ...postes] : postes;

  // Alertes anticipées : mêmes règles que le serveur (blocage) + homonymes (simple avertissement)
  const alertes = useMemo(() => {
    const cin = v.cin.trim() ? cinNormalise(v.cin) : '';
    const doublonCin = cin ? autres.find((a) => a.cin && cinNormalise(a.cin) === cin) : undefined;
    let memePersonne: PersonnelLigne | undefined;
    let homonyme: PersonnelLigne | undefined;
    if (v.nom.trim() && v.prenom.trim()) {
      const cle = normaliser(`${v.nom} ${v.prenom}`);
      const memes = autres.filter((a) => normaliser(`${a.nom} ${a.prenom}`) === cle);
      memePersonne = v.dateNaissance ? memes.find((a) => jourIso(a.dateNaissance) === v.dateNaissance) : undefined;
      homonyme = memePersonne ? undefined : memes[0];
    }
    return { doublonCin, memePersonne, homonyme };
  }, [v.cin, v.nom, v.prenom, v.dateNaissance, autres]);

  function valider() {
    const e: Record<string, string> = {};
    if (!v.nom.trim()) e.nom = 'Le nom est obligatoire.';
    if (!v.prenom.trim()) e.prenom = 'Le prénom est obligatoire.';
    if (!v.poste) e.poste = 'Choisissez le poste.';
    if (!v.dateEmbauche) e.dateEmbauche = "La date d'embauche est obligatoire.";
    if (v.dateNaissance && v.dateNaissance > aujourdhui) e.dateNaissance = 'La date de naissance ne peut pas être dans le futur.';
    if (v.cin.trim() && !/^[A-Za-z0-9\s.\-]{6,30}$/.test(v.cin.trim())) e.cin = 'CIN invalide (6 à 30 caractères).';
    if (v.telephone.trim() && !/^[0-9+\s().\-]{6,30}$/.test(v.telephone.trim())) e.telephone = 'Numéro de téléphone invalide.';
    if (v.indemnite.trim() && !(Number(v.indemnite.replace(',', '.')) >= 0)) e.indemnite = 'Saisissez un montant positif.';
    if (v.dateDepart && v.dateEmbauche && v.dateDepart < v.dateEmbauche) e.dateDepart = "Le départ ne peut pas précéder l'embauche.";
    if (alertes.doublonCin) e.cin = `Ce CIN est déjà enregistré pour ${nomComplet(alertes.doublonCin)} (${alertes.doublonCin.matricule}).`;
    if (alertes.memePersonne) e.nom = `Cette personne existe déjà (${alertes.memePersonne.matricule}).`;
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (enCours) return;
    setErreurGenerale(null);
    if (!valider()) return;

    const vide = (s: string) => (s.trim() === '' ? null : s.trim());
    const corps: Record<string, unknown> = {
      nom: v.nom.trim(), prenom: v.prenom.trim(), sexe: v.sexe === AUCUN ? null : v.sexe,
      dateNaissance: vide(v.dateNaissance), cin: vide(v.cin), telephone: vide(v.telephone),
      adresse: vide(v.adresse), lieuAffectation: vide(v.lieuAffectation), numeroCnaps: vide(v.numeroCnaps),
      banque: vide(v.banque), dateRetraite: vide(v.dateRetraite), dateEmbauche: v.dateEmbauche,
      salleAffecteeId: v.salle === AUCUN ? null : Number(v.salle),
      autorisationEnseigner: v.autorisationEnseigner,
      indemniteTransportJour: v.indemnite.trim() === '' ? null : Number(v.indemnite.replace(',', '.')),
    };

    setEnCours(true);
    try {
      if (personnel) {
        // Le poste n'est envoyé que s'il change (un ancien poste hors liste serait refusé)
        if (v.poste !== personnel.poste) corps.poste = v.poste;
        if (personnel.dateDepart) corps.dateDepart = vide(v.dateDepart);
        await api.patch(`/rh/personnel/${personnel.id}`, corps);
      } else {
        await api.post('/rh/personnel', { ...corps, poste: v.poste });
      }
      router.push('/dashboard/personnel');
    } catch (e) {
      setErreurGenerale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const saisie = (
    cle: CleTexte, label: string,
    opts: { type?: string; requis?: boolean; aide?: string; avert?: string; inputMode?: 'numeric' | 'tel' | 'text'; max?: string } = {},
  ) => (
    <Champ id={cle} label={label} requis={opts.requis} erreur={erreurs[cle]} avert={opts.avert} aide={opts.aide}>
      <Input
        id={cle} type={opts.type ?? 'text'} inputMode={opts.inputMode} max={opts.max} autoComplete="off"
        value={v[cle]} onChange={(e) => setTexte(cle, e.target.value)}
        aria-invalid={!!erreurs[cle]} aria-describedby={`${cle}-msg`} className="h-11 text-base"
      />
    </Champ>
  );

  if (utilisateur && utilisateur.role !== 'ADMIN') {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administrateur.</AlertDescription></Alert>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {erreurGenerale && <Alert variant="destructive" role="alert"><AlertDescription>{erreurGenerale}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Identité</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {saisie('nom', 'Nom', { requis: true })}
          {saisie('prenom', 'Prénom', {
            requis: true,
            avert: alertes.homonyme ? `${nomComplet(alertes.homonyme)} (${alertes.homonyme.matricule}) porte déjà ce nom. Vérifiez qu'il ne s'agit pas de la même personne.` : undefined,
          })}
          <Champ id="sexe" label="Sexe">
            <Select value={v.sexe} onValueChange={(x) => setV((p) => ({ ...p, sexe: x }))}>
              <SelectTrigger id="sexe" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Non précisé</SelectItem>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </Champ>
          {saisie('dateNaissance', 'Date de naissance', { type: 'date', max: aujourdhui })}
          {saisie('cin', 'CIN', { aide: 'Espaces, points et tirets sont ignorés.' })}
          {saisie('telephone', 'Téléphone', { type: 'tel', inputMode: 'tel' })}
          <div className="sm:col-span-2">{saisie('adresse', 'Adresse')}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Poste et affectation</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Champ id="poste" label="Poste" requis erreur={erreurs.poste}
            avert={posteAncien ? `« ${v.poste} » est un ancien libellé. Choisissez un poste de la liste pour harmoniser.` : undefined}>
            <Select value={v.poste} onValueChange={(x) => setTexte('poste', x)}>
              <SelectTrigger id="poste" className="h-11 w-full text-base" aria-invalid={!!erreurs.poste} aria-describedby="poste-msg">
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {optionsPostes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Champ>
          <Champ id="salle" label="Salle habituelle">
            <Select value={v.salle} onValueChange={(x) => setV((p) => ({ ...p, salle: x }))}>
              <SelectTrigger id="salle" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Aucune</SelectItem>
                {salles.map((s) => <SelectItem key={s.id} value={String(s.id)}>{libelleSalle(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Champ>
          {saisie('lieuAffectation', "Lieu d'affectation", { aide: 'Utile seulement si plusieurs sites.' })}
          <label className="flex min-h-11 items-center gap-2 self-end text-base">
            <input type="checkbox" className="size-5 accent-primary" checked={v.autorisationEnseigner}
              onChange={(e) => setV((p) => ({ ...p, autorisationEnseigner: e.target.checked }))} />
            Autorisé à enseigner
          </label>
          {saisie('dateEmbauche', "Date d'embauche", { type: 'date', requis: true })}
          {saisie('dateRetraite', 'Date de retraite prévue', { type: 'date' })}
          {edition && personnel?.dateDepart && saisie('dateDepart', 'Date de départ', {
            type: 'date', aide: "Videz ce champ pour annuler le départ. Un compte désactivé doit alors être réactivé depuis « Utilisateurs ».",
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Administratif (confidentiel)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {saisie('numeroCnaps', 'Numéro CNAPS')}
          {saisie('banque', 'Banque')}
          {saisie('indemnite', 'Indemnité de transport par jour (Ar)', { inputMode: 'numeric' })}
          <p className="self-end text-sm text-muted-foreground">Ces informations ne sont visibles que de l&apos;administrateur, de la directrice et du comptable.</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={enCours}>
          {enCours ? 'Enregistrement...' : edition ? 'Enregistrer les modifications' : 'Créer la fiche'}
        </Button>
        <Link href="/dashboard/personnel" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Annuler</Link>
      </div>
    </form>
  );
}
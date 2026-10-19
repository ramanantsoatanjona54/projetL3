'use client';

import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { normaliser } from '@/lib/normaliser';
import { traduireErreursServeur } from '@/lib/erreurs';
import type { Eleve } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const VIDE = {
  nom: '', prenom: '', sexe: '', dateNaissance: '', numeroInscription: '', dateInscription: '',
  taille: '', assurance: '', assuranceExpiration: '', dossiersManquants: '',
  telephone: '', email1: '', email2: '', quartier: '', professionPere: '', professionMere: '',
};
export type Champs = typeof VIDE;
type Mode = 'creation' | 'modification';

const OBLIGATOIRES = ['nom', 'prenom', 'sexe', 'dateNaissance'];
const LIBELLES: Record<string, string> = {
  nom: 'Le nom', prenom: 'Le prénom', sexe: 'Le sexe', dateNaissance: 'La date de naissance',
  numeroInscription: "Le numéro d'inscription", dateInscription: "La date d'admission",
  taille: 'La taille', assurance: "L'assurance", assuranceExpiration: "La fin de l'assurance",
  dossiersManquants: 'Les pièces manquantes', telephone: 'Le téléphone', email1: "L'email principal",
  email2: "L'email secondaire", quartier: 'Le quartier', professionPere: 'La profession du père',
  professionMere: 'La profession de la mère',
};
const EMAIL = /^\S+@\S+\.\S+$/;

function valider(f: Champs): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.nom.trim()) e.nom = 'Le nom est obligatoire.';
  if (!f.prenom.trim()) e.prenom = 'Le prénom est obligatoire.';
  if (!f.sexe) e.sexe = 'Choisissez le sexe.';
  if (!f.dateNaissance) {
    e.dateNaissance = 'La date de naissance est obligatoire.';
  } else {
    const d = new Date(f.dateNaissance);
    if (isNaN(d.getTime()) || d > new Date()) e.dateNaissance = 'Date invalide : elle ne peut pas être dans le futur.';
  }
  if (f.taille) {
    const t = Number(f.taille.replace(',', '.'));
    if (isNaN(t) || t < 30 || t > 250) e.taille = 'Taille invalide (en cm, entre 30 et 250).';
  }
  if (f.email1 && !EMAIL.test(f.email1)) e.email1 = 'Adresse email invalide.';
  if (f.email2 && !EMAIL.test(f.email2)) e.email2 = 'Adresse email invalide.';
  return e;
}

// Création : les champs vides sont omis. Modification : un champ vidé est envoyé à null pour l'effacer.
function construirePayload(f: Champs, mode: Mode) {
  const p: Record<string, unknown> = {};
  for (const [k, brut] of Object.entries(f)) {
    const v = brut.trim();
    if (v === '') {
      if (mode === 'modification' && !OBLIGATOIRES.includes(k)) p[k] = null;
      continue;
    }
    p[k] = k === 'taille' ? Number(v.replace(',', '.')) : v;
  }
  return p;
}

function Champ({ id, label, erreur, children }: { id: string; label: string; erreur?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-base">{label}</Label>
      {children}
      {erreur && <p id={`${id}-erreur`} className="text-sm text-destructive">{erreur}</p>}
    </div>
  );
}

interface Props {
  mode: Mode;
  eleveId?: number;
  matricule?: string;
  initial?: Partial<Champs>;
  onSuccess: () => void;
}

export function FormulaireEleve({ mode, eleveId, matricule, initial, onSuccess }: Props) {
  const [f, setF] = useState<Champs>({ ...VIDE, ...initial });
  const [existants, setExistants] = useState<Eleve[]>([]);
  const [confirmeHomonyme, setConfirmeHomonyme] = useState(false);
  const [conflitServeur, setConflitServeur] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const haut = useRef<HTMLDivElement>(null);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<Eleve[] | { data: Eleve[] }>('/eleves')
      .then((r) => setExistants(Array.isArray(r) ? r : r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (erreurGenerale) haut.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [erreurGenerale]);

  const set = (k: keyof Champs, valeur: string) => {
    setF((p) => ({ ...p, [k]: valeur }));
    setErreurs((p) => { const { [k]: _, ...reste } = p; return reste; });
    setErreurGenerale(null);
    if (k === 'nom' || k === 'prenom' || k === 'dateNaissance') {
      setConflitServeur(null);
      setConfirmeHomonyme(false);
    }
  };

  const doublon = useMemo(() => {
    if (!f.nom || !f.prenom || !f.dateNaissance) return null;
    const cle = normaliser(`${f.nom} ${f.prenom}`);
    return existants.find(
      (e) => e.id !== eleveId && normaliser(`${e.nom} ${e.prenom}`) === cle && e.dateNaissance.slice(0, 10) === f.dateNaissance,
    ) ?? null;
  }, [f.nom, f.prenom, f.dateNaissance, existants, eleveId]);

  const bloque = (!!doublon || !!conflitServeur) && !confirmeHomonyme;
  const focaliser = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (enCours) return;
    setErreurGenerale(null);

    const locales = valider(f);
    setErreurs(locales);
    const premiere = Object.keys(locales)[0];
    if (premiere) { focaliser(premiere); return; }

    if (bloque) {
      setErreurGenerale("Confirmez qu'il s'agit bien d'un autre élève (homonyme), ou ouvrez la fiche existante.");
      return;
    }

    setEnCours(true);
    const payload = construirePayload(f, mode);
    if (confirmeHomonyme) payload.confirmerHomonyme = true;

    try {
      if (mode === 'creation') await api.post('/eleves', payload);
      else await api.patch(`/eleves/${eleveId}`, payload);
      onSuccess(); // "enCours" reste actif pendant la navigation (évite le double clic)
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setErreurGenerale('Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.');
      } else if (err.status === 409 && err.message.includes('homonyme')) {
        setConflitServeur(err.message);
      } else if (err.status === 409 && err.message.includes("numéro d'inscription")) {
        setErreurs({ numeroInscription: err.message });
        focaliser('numeroInscription');
      } else if (err.status === 401 || err.status === 403) {
        setErreurGenerale("Votre session a expiré ou vous n'avez pas le droit de faire cette action. Reconnectez-vous.");
      } else {
        const { champs, generale } = traduireErreursServeur(err.message, LIBELLES);
        setErreurs(champs);
        const premierChamp = Object.keys(champs)[0];
        if (premierChamp) focaliser(premierChamp);
        setErreurGenerale(generale ?? (premierChamp ? 'Corrigez les champs signalés.' : 'Enregistrement impossible.'));
      }
      setEnCours(false);
    }
  }

  const props = (id: keyof Champs) => ({
    id,
    value: f[id],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(id, e.target.value),
    className: 'h-11 text-base',
    'aria-invalid': !!erreurs[id],
    'aria-describedby': erreurs[id] ? `${id}-erreur` : undefined,
  });

  const retour = mode === 'creation' ? '/dashboard/eleves' : `/dashboard/eleves/${eleveId}`;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-3xl font-semibold">{mode === 'creation' ? 'Nouvel élève' : "Modifier l'élève"}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {mode === 'creation'
          ? "Le matricule est généré automatiquement à l'enregistrement. "
          : `Matricule ${matricule} (non modifiable). Les modifications sont enregistrées dans le journal d'audit. `}
        Les champs marqués * sont obligatoires.
      </p>

      <div ref={haut}>
        {erreurGenerale && (
          <Alert variant="destructive" role="alert" className="mb-6">
            <AlertDescription>{erreurGenerale}</AlertDescription>
          </Alert>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader><CardTitle>Identité</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ id="nom" label="Nom *" erreur={erreurs.nom}><Input {...props('nom')} autoComplete="off" /></Champ>
            <Champ id="prenom" label="Prénom *" erreur={erreurs.prenom}><Input {...props('prenom')} autoComplete="off" /></Champ>
            <Champ id="sexe" label="Sexe *" erreur={erreurs.sexe}>
              <Select value={f.sexe} onValueChange={(v) => set('sexe', v)}>
                <SelectTrigger id="sexe" className="h-11 w-full text-base" aria-invalid={!!erreurs.sexe} aria-describedby={erreurs.sexe ? 'sexe-erreur' : undefined}>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </Champ>
            <Champ id="dateNaissance" label="Date de naissance *" erreur={erreurs.dateNaissance}>
              <Input {...props('dateNaissance')} type="date" max={aujourdhui} />
            </Champ>
          </CardContent>
        </Card>

        {(doublon || conflitServeur) && (
          <Alert role="alert">
            <AlertTitle>Cet élève existe peut-être déjà</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {doublon ? (
                  <>
                    {doublon.nom.toUpperCase()} {doublon.prenom}, né(e) le{' '}
                    {new Date(doublon.dateNaissance).toLocaleDateString('fr-FR')} : matricule {doublon.matricule}.{' '}
                    <Link href={`/dashboard/eleves/${doublon.id}`} className="font-medium underline">Ouvrir sa fiche</Link>
                  </>
                ) : (
                  conflitServeur
                )}
              </p>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={confirmeHomonyme} onChange={(e) => setConfirmeHomonyme(e.target.checked)} className="size-4" />
                Il s&apos;agit bien d&apos;un autre élève (homonyme)
              </label>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dossier d&apos;admission</CardTitle>
            <CardDescription>Informations du dossier papier.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ id="numeroInscription" label="Numéro d'inscription" erreur={erreurs.numeroInscription}><Input {...props('numeroInscription')} /></Champ>
            <Champ id="dateInscription" label="Date d'admission" erreur={erreurs.dateInscription}><Input {...props('dateInscription')} type="date" max={aujourdhui} /></Champ>
            <Champ id="taille" label="Taille (cm)" erreur={erreurs.taille}><Input {...props('taille')} inputMode="decimal" /></Champ>
            <Champ id="assurance" label="Assurance" erreur={erreurs.assurance}><Input {...props('assurance')} /></Champ>
            <Champ id="assuranceExpiration" label="Fin de l'assurance" erreur={erreurs.assuranceExpiration}><Input {...props('assuranceExpiration')} type="date" /></Champ>
            <div className="sm:col-span-2">
              <Champ id="dossiersManquants" label="Pièces manquantes au dossier" erreur={erreurs.dossiersManquants}>
                <Textarea
                  id="dossiersManquants"
                  value={f.dossiersManquants}
                  onChange={(e) => set('dossiersManquants', e.target.value)}
                  rows={3}
                  className="text-base"
                  placeholder="Ex. : acte de naissance, certificat de vaccination"
                />
              </Champ>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact et famille</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Champ id="telephone" label="Téléphone" erreur={erreurs.telephone}><Input {...props('telephone')} type="tel" autoComplete="tel" /></Champ>
            <Champ id="quartier" label="Quartier" erreur={erreurs.quartier}><Input {...props('quartier')} /></Champ>
            <Champ id="email1" label="Email principal" erreur={erreurs.email1}><Input {...props('email1')} type="email" /></Champ>
            <Champ id="email2" label="Email secondaire" erreur={erreurs.email2}><Input {...props('email2')} type="email" /></Champ>
            <Champ id="professionPere" label="Profession du père" erreur={erreurs.professionPere}><Input {...props('professionPere')} /></Champ>
            <Champ id="professionMere" label="Profession de la mère" erreur={erreurs.professionMere}><Input {...props('professionMere')} /></Champ>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={enCours}>
            {enCours ? 'Enregistrement...' : mode === 'creation' ? "Enregistrer l'élève" : 'Enregistrer les modifications'}
          </Button>
          <Button asChild type="button" variant="outline" size="lg"><Link href={retour}>Annuler</Link></Button>
        </div>
      </form>
    </div>
  );
}
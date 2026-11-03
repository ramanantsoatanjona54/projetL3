'use client';

import { useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { traduireErreursServeur } from '@/lib/erreurs';
import type { ParentEleve } from '@/lib/types';
import { erreurNom, erreurTelephone, saisieNom, saisieTelephone } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const VIDE = { nom: '', prenom: '', telephone: '', email: '', lienParente: '' };
const LIBELLES: Record<string, string> = {
  nom: 'Le nom', prenom: 'Le prénom', telephone: 'Le téléphone', email: "L'email", lienParente: 'Le lien de parenté',
};
const LIENS = [
  { valeur: 'pere', libelle: 'Père' },
  { valeur: 'mere', libelle: 'Mère' },
  { valeur: 'tuteur', libelle: 'Tuteur' },
];

export interface ResultatAjout {
  rattache: ParentEleve;
  saisie: typeof VIDE;
}

interface Props {
  eleveId: number;
  onAjoute: (r: ResultatAjout) => void;
  /** Natures de lien déjà enregistrées pour cet élève (ex. ['pere', 'mere']) */
  liensPris?: string[];
}

export function AjouterParent({ eleveId, onAjoute, liensPris = [] }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [generale, setGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const complet = liensPris.length >= LIENS.length;

  const set = (k: keyof typeof VIDE, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErreurs((p) => { const { [k]: _, ...reste } = p; return reste; });
    setGenerale(null);
  };

  function valider() {
    const e: Record<string, string> = {};
    const n = erreurNom(f.nom, 'Le nom'); if (n) e.nom = n;
    const p = erreurNom(f.prenom, 'Le prénom'); if (p) e.prenom = p;
    const t = erreurTelephone(f.telephone, true); if (t) e.telephone = t;
    if (!f.lienParente) e.lienParente = 'Choisissez le lien de parenté.';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Adresse email invalide.';
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (enCours) return;
    const locales = valider();
    setErreurs(locales);
    if (Object.keys(locales).length) return;

    setEnCours(true);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, v.trim()]));
    try {
      const rattache = await api.post<ParentEleve>(`/eleves/${eleveId}/parents`, payload);
      onAjoute({ rattache, saisie: f });
      setF(VIDE);
      setOuvert(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const { champs, generale: g } = traduireErreursServeur(err.message, LIBELLES);
        setErreurs(champs);
        setGenerale(g ?? (Object.keys(champs).length ? 'Corrigez les champs signalés.' : err.message));
      } else {
        setGenerale('Connexion au serveur impossible. Réessayez.');
      }
    } finally {
      setEnCours(false);
    }
  }

  // Filtre appliqué à la frappe : lettres seulement pour les noms, chiffres seulement pour le téléphone
  const filtre = (id: keyof typeof VIDE, v: string) =>
    id === 'nom' || id === 'prenom' ? saisieNom(v) : id === 'telephone' ? saisieTelephone(v) : v;

  const champ = (id: keyof typeof VIDE, label: string, type = 'text') => (
    <div className="space-y-1.5">
      <Label htmlFor={`p-${id}`} className="text-base">{label}</Label>
      <Input
        id={`p-${id}`}
        type={type}
        value={f[id]}
        onChange={(e) => set(id, filtre(id, e.target.value))}
        inputMode={id === 'telephone' ? 'numeric' : undefined}
        maxLength={id === 'telephone' ? 14 : id === 'nom' || id === 'prenom' ? 100 : undefined}
        className="h-11 text-base"
        aria-invalid={!!erreurs[id]}
        aria-describedby={erreurs[id] ? `p-${id}-erreur` : undefined}
      />
      {erreurs[id] && <p id={`p-${id}-erreur`} className="text-sm text-destructive">{erreurs[id]}</p>}
    </div>
  );

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={complet}
          title={complet ? 'Maximum atteint : un père, une mère et un tuteur' : undefined}
        >
          Ajouter un parent
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un parent ou tuteur</DialogTitle>
          <DialogDescription>
            Un élève a au plus 3 responsables : un père, une mère et un tuteur. Si ce numéro de téléphone est déjà
            enregistré pour un autre enfant, le parent existant est réutilisé (pas de doublon dans les fratries).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {generale && <Alert variant="destructive" role="alert"><AlertDescription>{generale}</AlertDescription></Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            {champ('nom', 'Nom *')}
            {champ('prenom', 'Prénom *')}
          </div>
          {champ('telephone', 'Téléphone * (10 chiffres)', 'tel')}
          {champ('email', 'Email', 'email')}
          <div className="space-y-1.5">
            <Label htmlFor="p-lien" className="text-base">Lien de parenté *</Label>
            <Select value={f.lienParente} onValueChange={(v) => set('lienParente', v)}>
              <SelectTrigger id="p-lien" className="h-11 w-full text-base" aria-invalid={!!erreurs.lienParente}>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {LIENS.map((l) => {
                  const pris = liensPris.includes(l.valeur);
                  return (
                    <SelectItem key={l.valeur} value={l.valeur} disabled={pris}>
                      {l.libelle}{pris ? ' (déjà enregistré)' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {erreurs.lienParente && <p className="text-sm text-destructive">{erreurs.lienParente}</p>}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={enCours}>
            {enCours ? 'Enregistrement...' : 'Rattacher ce parent'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
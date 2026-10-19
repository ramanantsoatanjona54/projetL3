'use client';

import { useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { traduireErreursServeur } from '@/lib/erreurs';
import type { ParentEleve } from '@/lib/types';
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

export interface ResultatAjout {
  rattache: ParentEleve;
  saisie: typeof VIDE;
}

export function AjouterParent({ eleveId, onAjoute }: { eleveId: number; onAjoute: (r: ResultatAjout) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [generale, setGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const set = (k: keyof typeof VIDE, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErreurs((p) => { const { [k]: _, ...reste } = p; return reste; });
    setGenerale(null);
  };

  function valider() {
    const e: Record<string, string> = {};
    if (!f.nom.trim()) e.nom = 'Le nom est obligatoire.';
    if (!f.prenom.trim()) e.prenom = 'Le prénom est obligatoire.';
    if (!f.telephone.trim()) e.telephone = 'Le téléphone est obligatoire.';
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

  const champ = (id: keyof typeof VIDE, label: string, type = 'text') => (
    <div className="space-y-1.5">
      <Label htmlFor={`p-${id}`} className="text-base">{label}</Label>
      <Input
        id={`p-${id}`}
        type={type}
        value={f[id]}
        onChange={(e) => set(id, e.target.value)}
        className="h-11 text-base"
        aria-invalid={!!erreurs[id]}
        aria-describedby={erreurs[id] ? `p-${id}-erreur` : undefined}
      />
      {erreurs[id] && <p id={`p-${id}-erreur`} className="text-sm text-destructive">{erreurs[id]}</p>}
    </div>
  );

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger asChild><Button variant="outline">Ajouter un parent</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un parent ou tuteur</DialogTitle>
          <DialogDescription>
            Si ce numéro de téléphone est déjà enregistré pour un autre enfant, le parent existant est réutilisé
            (pas de doublon dans les fratries).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {generale && <Alert variant="destructive" role="alert"><AlertDescription>{generale}</AlertDescription></Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            {champ('nom', 'Nom *')}
            {champ('prenom', 'Prénom *')}
          </div>
          {champ('telephone', 'Téléphone *', 'tel')}
          {champ('email', 'Email', 'email')}
          <div className="space-y-1.5">
            <Label htmlFor="p-lien" className="text-base">Lien de parenté *</Label>
            <Select value={f.lienParente} onValueChange={(v) => set('lienParente', v)}>
              <SelectTrigger id="p-lien" className="h-11 w-full text-base" aria-invalid={!!erreurs.lienParente}>
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pere">Père</SelectItem>
                <SelectItem value="mere">Mère</SelectItem>
                <SelectItem value="tuteur">Tuteur</SelectItem>
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
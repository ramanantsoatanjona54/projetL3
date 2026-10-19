'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Minus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext'; // adaptez le nom exact exporté
import { messageErreur } from '@/lib/messages';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ChangerMotDePasse() {
  const { utilisateur, seDeconnecter } = useAuth();
  const router = useRouter();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [termine, setTermine] = useState(false);

  const criteres = [
    { ok: nouveau.length >= 10 && nouveau.length <= 64, label: '10 à 64 caractères' },
    { ok: /[a-z]/.test(nouveau), label: 'Une minuscule' },
    { ok: /[A-Z]/.test(nouveau), label: 'Une majuscule' },
    { ok: /\d/.test(nouveau), label: 'Un chiffre' },
    { ok: /[^A-Za-z0-9]/.test(nouveau), label: 'Un symbole (! # @ ...)' },
  ];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (enCours) return;
    setErreurGenerale(null);
    const loc: Record<string, string> = {};
    if (!ancien) loc.ancien = 'Saisissez votre mot de passe actuel.';
    if (!criteres.every((c) => c.ok)) loc.nouveau = 'Le nouveau mot de passe ne respecte pas toutes les règles.';
    else if (nouveau === ancien) loc.nouveau = "Le nouveau mot de passe doit être différent de l'actuel.";
    if (nouveau !== confirmation) loc.confirmation = 'Les deux mots de passe ne sont pas identiques.';
    setErreurs(loc);
    if (Object.keys(loc).length) return;

    setEnCours(true);
    try {
      await api.post('/auth/changer-mot-de-passe', { ancienMotDePasse: ancien, nouveauMotDePasse: nouveau });
      setTermine(true);
    } catch (err) {
      setErreurGenerale(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  // La session est fermée pour repartir proprement avec le nouveau mot de passe
  async function seReconnecter() {
    await seDeconnecter();
    router.push('/login');
  }

  if (termine) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Alert role="status">
          <AlertTitle>Mot de passe modifié</AlertTitle>
          <AlertDescription>Reconnectez-vous avec votre nouveau mot de passe.</AlertDescription>
        </Alert>
        <Button size="lg" onClick={seReconnecter}>Se reconnecter</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-3xl font-semibold">Mon mot de passe</h1>
      <p className="mb-6 text-sm text-muted-foreground">{utilisateur?.email}</p>

      {utilisateur?.doitChangerMotDePasse && (
        <Alert role="alert" className="mb-6">
          <AlertTitle>Première connexion</AlertTitle>
          <AlertDescription>Vous utilisez un mot de passe temporaire. Choisissez le vôtre pour continuer.</AlertDescription>
        </Alert>
      )}
      {erreurGenerale && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreurGenerale}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Changer le mot de passe</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ancien" className="text-base">Mot de passe actuel</Label>
              <Input id="ancien" type={visible ? 'text' : 'password'} autoComplete="current-password" value={ancien}
                onChange={(e) => setAncien(e.target.value)} aria-invalid={!!erreurs.ancien}
                aria-describedby={erreurs.ancien ? 'ancien-erreur' : undefined} className="h-11 text-base" />
              {erreurs.ancien && <p id="ancien-erreur" className="text-sm text-destructive">{erreurs.ancien}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nouveau" className="text-base">Nouveau mot de passe</Label>
              <Input id="nouveau" type={visible ? 'text' : 'password'} autoComplete="new-password" value={nouveau}
                onChange={(e) => setNouveau(e.target.value)} aria-invalid={!!erreurs.nouveau}
                aria-describedby="regles nouveau-erreur" className="h-11 text-base" />
              <ul id="regles" className="grid gap-1 pt-1 text-sm">
                {criteres.map((c) => (
                  <li key={c.label} className={`flex items-center gap-2 ${c.ok ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {c.ok ? <Check className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                    {c.label}<span className="sr-only">{c.ok ? ' : respecté' : ' : manquant'}</span>
                  </li>
                ))}
              </ul>
              {erreurs.nouveau && <p id="nouveau-erreur" className="text-sm text-destructive">{erreurs.nouveau}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmation" className="text-base">Confirmer le nouveau mot de passe</Label>
              <Input id="confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)} aria-invalid={!!erreurs.confirmation}
                aria-describedby={erreurs.confirmation ? 'confirmation-erreur' : undefined} className="h-11 text-base" />
              {erreurs.confirmation && <p id="confirmation-erreur" className="text-sm text-destructive">{erreurs.confirmation}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={enCours}>{enCours ? 'Enregistrement...' : 'Changer le mot de passe'}</Button>
              <Button type="button" variant="ghost" aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
                {visible ? 'Masquer' : 'Afficher'} les mots de passe
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
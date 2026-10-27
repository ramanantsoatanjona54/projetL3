'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function FormulaireCode2fa() {
  const { validerCode, annulerDefi } = useAuth();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (enCours) return;
    setEnCours(true); setErreur(null);
    try { await validerCode(code); } catch (err) { setErreur(messageErreur(err)); setEnCours(false); }
  }

  return (
    <form onSubmit={envoyer} className="space-y-4" noValidate>
      <div>
        <h2 className="text-xl font-semibold">Vérification en deux étapes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ouvrez votre application d&apos;authentification et saisissez le code à 6 chiffres, ou l&apos;un de vos codes de secours.
        </p>
      </div>
      {erreur && <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div className="space-y-1.5">
        <Label htmlFor="code2fa" className="text-base">Code</Label>
        <Input
          id="code2fa" value={code} onChange={(e) => setCode(e.target.value)} autoFocus required
          autoComplete="one-time-code" inputMode="text" maxLength={14} className="h-12 text-lg tracking-widest"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={enCours || code.trim().length < 6}>{enCours ? 'Vérification...' : 'Valider'}</Button>
        <Button type="button" size="lg" variant="outline" onClick={annulerDefi} disabled={enCours}>Retour</Button>
      </div>
    </form>
  );
}
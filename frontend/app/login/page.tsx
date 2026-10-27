'use client';

import { useState, FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth, ApiError } from '@/context/AuthContext';
import { FormulaireCode2fa } from '@/components/FormulaireCode2fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const { seConnecter, defi2fa } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await seConnecter(email, motDePasse);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Connexion impossible pour le moment.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
            <div className="mb-4">
            <Logo taille={72} decoratif priorite />
          </div>
          <h1 className="text-3xl font-semibold">Les Colibris</h1>
        </div>

        {defi2fa ? (
          <FormulaireCode2fa />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Connexion</CardTitle>
              <CardDescription>Entrez vos identifiants pour accéder à votre espace.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    
                    aria-invalid={!!erreur}
                    aria-describedby={erreur ? 'erreur-login' : undefined}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="motDePasse">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="motDePasse"
                      type={afficher ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      className="pr-10"
                      aria-invalid={!!erreur}
                      aria-describedby={erreur ? 'erreur-login' : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                      onClick={() => setAfficher((v) => !v)}
                      aria-label={afficher ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      aria-pressed={afficher}
                    >
                      {afficher ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>

                {erreur && (
                  <p
                    id="erreur-login"
                    role="alert"
                    className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {erreur}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={enCours}>
                  {enCours ? 'Connexion...' : 'Se connecter'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
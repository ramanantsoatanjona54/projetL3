'use client';

import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GestionEdt } from '@/components/emploi-du-temps/GestionEdt';

export default function EmploiDuTemps() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ADMIN', 'DIRECTRICE', 'SECRETARIAT', 'ENSEIGNANT', 'COMPTABLE'].includes(role);
  const peutGerer = role === 'ADMIN' || role === 'DIRECTRICE';

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée au personnel de l&apos;école.</AlertDescription></Alert>;
  }
  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Emploi du temps</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {peutGerer ? "Construisez l'emploi du temps de chaque salle, du lundi au vendredi." : 'Emploi du temps de chaque salle, du lundi au vendredi.'}
      </p>
      <GestionEdt peutGerer={peutGerer} />
    </div>
  );
}
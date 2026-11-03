'use client';

import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Evaluations } from '@/components/evaluations/Evaluations';

export default function PageSuiviPedagogique() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe pédagogique.</AlertDescription></Alert>;
  }
  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Suivi pédagogique</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {role === 'ENSEIGNANT'
          ? "Cochez ce qui a été vu en classe. Les niveaux A, EA, AR et NA de chaque élève se saisissent dans son bulletin."
          : "Consultation de ce qui a été vu en classe, salle par salle."}
      </p>
      <Evaluations peutSaisir={role === 'ENSEIGNANT'} />
    </div>
  );
}
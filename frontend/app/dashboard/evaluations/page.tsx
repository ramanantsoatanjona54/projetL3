'use client';

import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Evaluations } from '@/components/evaluations/Evaluations';

export default function PageEvaluations() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe pédagogique.</AlertDescription></Alert>;
  }
  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Évaluations</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {role === 'ENSEIGNANT'
          ? "Choisissez une compétence ou une leçon, puis indiquez le niveau d'acquisition de chaque élève."
          : 'Consultation des évaluations et de la progression de chaque salle.'}
      </p>
      <Evaluations peutSaisir={role === 'ENSEIGNANT'} />
    </div>
  );
}
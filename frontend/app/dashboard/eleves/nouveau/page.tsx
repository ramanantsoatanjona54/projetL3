'use client';

import { useRouter } from 'next/navigation';
import { FormulaireEleve } from '@/components/eleves/FormulaireEleve';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

function FormulaireNouvelEleve() {
  const router = useRouter();
  return <FormulaireEleve mode="creation" onSuccess={() => router.push('/dashboard/eleves')} />;
}
export default function NouvelEleve() {
  const { utilisateur } = useAuth();
  if (utilisateur && utilisateur.role !== 'ADMIN') {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>La création d&apos;un élève est réservée à l&apos;administrateur.</AlertDescription>
      </Alert>
    );
  }
  return <FormulaireNouvelEleve />;
}
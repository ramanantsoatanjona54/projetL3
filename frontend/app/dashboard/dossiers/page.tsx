'use client';

import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dossiers } from '@/components/dossiers/Dossiers';

export default function PageDossiers() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ADMIN', 'DIRECTRICE', 'SECRETARIAT', 'ENSEIGNANT', 'COMPTABLE'].includes(role);
  const peutDeposer = ['ADMIN', 'DIRECTRICE', 'SECRETARIAT', 'ENSEIGNANT'].includes(role);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée au personnel de l&apos;école.</AlertDescription></Alert>;
  }
  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Documents partagés</h1>
      <p className="mb-6 text-sm text-muted-foreground">Circulaires, supports de cours et documents administratifs réservés au personnel.</p>
      <Dossiers peutDeposer={peutDeposer} />
    </div>
  );
}
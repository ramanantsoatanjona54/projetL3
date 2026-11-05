'use client';

import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dossiers } from '@/components/dossiers/Dossiers';

export default function PageEspaceDirection() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['DIRECTRICE', 'COMPTABLE'].includes(role);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cet espace est réservé à la direction et à la comptabilité.</AlertDescription></Alert>;
  }
  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Espace Direction</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Documents confidentiels partagés entre la directrice et le comptable. Aucun autre profil ne les voit.
      </p>
      <Dossiers espace="direction" peutDeposer />
    </div>
  );
}
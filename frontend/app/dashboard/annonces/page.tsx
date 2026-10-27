'use client';

import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ListeAnnonces } from '@/components/annonces/ListeAnnonces';

export default function Annonces() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const peutGerer = role === 'ADMIN' || role === 'DIRECTRICE';

  if (utilisateur && role === 'PARENT') {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée au personnel.</AlertDescription></Alert>;
  }
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-3xl font-semibold">Annonces</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Informations de l&apos;école. Les annonces publiques sont aussi visibles des parents.
      </p>
      <ListeAnnonces peutGerer={peutGerer} />
    </div>
  );
}
'use client';

import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Inventaire } from '@/components/inventaire/Inventaire';

export default function PageInventaire() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ADMIN', 'DIRECTRICE', 'SECRETARIAT', 'COMPTABLE'].includes(role);
  const peutGerer = ['ADMIN', 'SECRETARIAT', 'COMPTABLE'].includes(role);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à la gestion de l&apos;école.</AlertDescription></Alert>;
  }
  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Inventaire</h1>
      <p className="mb-6 text-sm text-muted-foreground">Mobilier et fournitures. Le stock évolue uniquement par entrées et sorties, toutes conservées dans l&apos;historique.</p>
      <Inventaire peutGerer={peutGerer} peutSupprimer={role === 'ADMIN'} />
    </div>
  );
}
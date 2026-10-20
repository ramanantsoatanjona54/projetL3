'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PointageJour } from '@/components/pointage/PointageJour';
import { RecapMensuel } from '@/components/pointage/RecapMensuel';

const ONGLETS = [
  { id: 'jour', libelle: 'Pointage du jour' },
  { id: 'mois', libelle: 'Récapitulatif mensuel' },
] as const;

export default function Pointage() {
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState<(typeof ONGLETS)[number]['id']>('jour');
  const admin = utilisateur?.role === 'ADMIN';
  const autorise = admin || utilisateur?.role === 'COMPTABLE' || utilisateur?.role === 'DIRECTRICE';

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administration.</AlertDescription></Alert>;
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Pointage du personnel</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {admin ? "Enregistrez les arrivées et départs, corrigez en cas d'oubli." : 'Consultation des présences.'}
      </p>

      <div role="tablist" aria-label="Sections du pointage" className="mb-6 flex gap-1 border-b border-border print:hidden">
        {ONGLETS.map((o) => (
          <button
            key={o.id} type="button" role="tab" id={`onglet-${o.id}`} aria-selected={onglet === o.id}
            aria-controls={`panneau-${o.id}`} onClick={() => setOnglet(o.id)}
            className={`min-h-11 border-b-2 px-4 font-medium ${onglet === o.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panneau-${onglet}`} aria-labelledby={`onglet-${onglet}`}>
        {onglet === 'jour' ? <PointageJour admin={admin} /> : <RecapMensuel />}
      </div>
    </div>
  );
}
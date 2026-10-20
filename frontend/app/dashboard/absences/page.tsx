'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppelDuJour } from '@/components/absences/AppelDuJour';
import { SuiviAbsences } from '@/components/absences/SuiviAbsences';

export default function Absences() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const peutFaireAppel = ['ENSEIGNANT', 'ADMIN', 'SECRETARIAT'].includes(role);
  const peutJustifier = ['ADMIN', 'SECRETARIAT'].includes(role);
  const autorise = peutFaireAppel || role === 'DIRECTRICE';

  const onglets = [
    ...(peutFaireAppel ? [{ id: 'appel', libelle: 'Appel du jour' }] : []),
    { id: 'suivi', libelle: 'Suivi des absences' },
  ];
  const [choisi, setChoisi] = useState<string>(peutFaireAppel ? 'appel' : 'suivi');

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée au personnel de l&apos;école.</AlertDescription></Alert>;
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Absences</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Faites l&apos;appel en cochant seulement les élèves absents. Les parents sont prévenus automatiquement.
      </p>

      <div role="tablist" aria-label="Sections des absences" className="mb-6 flex gap-1 border-b border-border">
        {onglets.map((o) => (
          <button
            key={o.id} type="button" role="tab" id={`onglet-${o.id}`} aria-selected={choisi === o.id}
            aria-controls={`panneau-${o.id}`} onClick={() => setChoisi(o.id)}
            className={`min-h-11 border-b-2 px-4 font-medium ${choisi === o.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panneau-${choisi}`} aria-labelledby={`onglet-${choisi}`}>
        {choisi === 'appel' ? <AppelDuJour /> : <SuiviAbsences peutJustifier={peutJustifier} />}
      </div>
    </div>
  );
}
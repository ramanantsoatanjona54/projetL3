'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MenuSemaine } from '@/components/menu/MenuSemaine';
import { PeriodesMenu } from '@/components/menu/PeriodesMenu';

export default function Menu() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
    const peutGerer = ['ADMIN', 'SECRETARIAT'].includes(role); // la directrice consulte seulement
  const [choisi, setChoisi] = useState('semaine');

  if (utilisateur && role === 'PARENT') {
    return <Alert variant="destructive" role="alert"><AlertDescription>Utilisez le menu de votre espace parent.</AlertDescription></Alert>;
  }

  const onglets = [
    { id: 'semaine', libelle: 'Menu de la semaine' },
    ...(peutGerer ? [{ id: 'periodes', libelle: 'Périodes' }] : []),
  ];

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Menu de la cantine</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {peutGerer ? "Créez une période, puis renseignez le menu jour par jour." : 'Menu de la semaine, du lundi au vendredi.'}
      </p>

      {onglets.length > 1 && (
        <div role="tablist" aria-label="Sections du menu" className="mb-6 flex gap-1 border-b border-border">
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
      )}

      <div role="tabpanel" id={`panneau-${choisi}`} aria-labelledby={`onglet-${choisi}`}>
        {choisi === 'periodes' && peutGerer ? <PeriodesMenu /> : <MenuSemaine peutModifier={peutGerer} />}
      </div>
    </div>
  );
}
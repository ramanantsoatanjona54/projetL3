
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext'; // adaptez le nom exact exporté
import { messageErreur } from '@/lib/messages';
import type { AnneeScolaire, Classe, Niveau, Salle } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnneesScolaires } from '@/components/structure/AnneesScolaires';
import { Classes } from '@/components/structure/Classes';
import { Niveaux } from '@/components/structure/Niveaux';
import { Salles } from '@/components/structure/Salles';

type Onglet = 'annees' | 'classes' | 'niveaux' | 'salles';
interface Donnees { annees: AnneeScolaire[]; classes: Classe[]; niveaux: Niveau[]; salles: Salle[] }

export default function Structure() {
  const { utilisateur } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('annees');
  const [data, setData] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Une modification dans un onglet peut en toucher un autre (ex. supprimer un niveau) : on recharge tout
  const charger = useCallback(() => {
    Promise.all([
      api.get<AnneeScolaire[]>('/structure/annees-scolaires'),
      api.get<Classe[]>('/structure/classes'),
      api.get<Niveau[]>('/structure/niveaux'),
      api.get<Salle[]>('/structure/salles'),
    ])
      .then(([annees, classes, niveaux, salles]) => { setData({ annees, classes, niveaux, salles }); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  if (utilisateur && utilisateur.role !== 'ADMIN') {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administrateur.</AlertDescription></Alert>;
  }

  const onglets: { id: Onglet; label: string; n?: number }[] = [
    { id: 'annees', label: 'Années scolaires', n: data?.annees.length },
    { id: 'classes', label: 'Classes', n: data?.classes.length },
    { id: 'niveaux', label: 'Niveaux', n: data?.niveaux.length },
    { id: 'salles', label: 'Salles', n: data?.salles.length },
  ];

  return (
    <div>
      <h1 className="text-3xl font-semibold">Structure scolaire</h1>
      <p className="mb-6 text-sm text-muted-foreground">Ordre conseillé : année scolaire, puis classes, niveaux et enfin salles.</p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreur}</AlertDescription></Alert>}

      <div role="tablist" aria-label="Structure scolaire" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {onglets.map((o) => (
          <button
            key={o.id} type="button" role="tab" id={`onglet-${o.id}`} aria-selected={onglet === o.id} aria-controls="panneau"
            onClick={() => setOnglet(o.id)}
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-base font-medium ${
              onglet === o.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}{o.n !== undefined && <span className="ml-1 text-sm text-muted-foreground">({o.n})</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panneau" aria-labelledby={`onglet-${onglet}`}>
        {!data ? (
          !erreur && <p className="text-muted-foreground">Chargement...</p>
        ) : onglet === 'annees' ? (
          <AnneesScolaires annees={data.annees} onChange={charger} />
        ) : onglet === 'classes' ? (
          <Classes classes={data.classes} onChange={charger} />
        ) : onglet === 'niveaux' ? (
          <Niveaux niveaux={data.niveaux} classes={data.classes} onChange={charger} />
        ) : (
          <Salles salles={data.salles} annees={data.annees} niveaux={data.niveaux} onChange={charger} />
        )}
      </div>
    </div>
  );
}
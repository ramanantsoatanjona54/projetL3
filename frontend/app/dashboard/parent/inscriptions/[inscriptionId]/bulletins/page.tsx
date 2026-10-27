'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { Bulletin, HistoriqueBulletins } from '@/lib/types';
import { BulletinVue } from '@/components/bulletins/BulletinVue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Choix { inscriptionId: number; semestre: number }

export default function PageBulletinsParent() {
  const { inscriptionId } = useParams<{ inscriptionId: string }>();
  const { utilisateur } = useAuth();
  const [histo, setHisto] = useState<HistoriqueBulletins | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [b, setB] = useState<Bulletin | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<HistoriqueBulletins>(`/parent/inscriptions/${inscriptionId}/bulletins/historique`)
      .then((h) => {
        setHisto(h);
        // Par défaut : le dernier bulletin de l'inscription ouverte, sinon le plus récent publié
        const courante = h.inscriptions.find((i) => String(i.inscriptionId) === inscriptionId && i.semestres.length > 0);
        const cible = courante ?? h.inscriptions.find((i) => i.semestres.length > 0);
        if (cible) setChoix({ inscriptionId: cible.inscriptionId, semestre: cible.semestres[cible.semestres.length - 1].semestre });
      })
      .catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId]);

  useEffect(() => {
    if (!choix) return;
    setB(null);
    api.get<Bulletin>(`/parent/inscriptions/${choix.inscriptionId}/bulletins/${choix.semestre}`)
      .then((r) => { setB(r); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [choix]);

  if (utilisateur && utilisateur.role !== 'PARENT') {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée aux parents.</AlertDescription></Alert>;
  }

  return (
    <div>
      <div className="no-print">
        <Link href="/dashboard/parent" className="text-sm underline underline-offset-4">← Mes enfants</Link>
        <h1 className="mb-1 mt-2 text-3xl font-semibold">Bulletins{histo ? ` de ${histo.eleve}` : ''}</h1>
        <p className="mb-4 text-sm text-muted-foreground">Seuls les bulletins publiés par l&apos;école sont affichés.</p>

        {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
        {histo && histo.inscriptions.length === 0 && (
          <Alert role="status"><AlertDescription>Aucun bulletin n&apos;est publié pour le moment. Vous serez prévenu(e) dès que l&apos;école le mettra à disposition.</AlertDescription></Alert>
        )}

        {histo && histo.inscriptions.length > 0 && (
          <div className="mb-4 space-y-3">
            {histo.inscriptions.map((i) => (
              <div key={i.inscriptionId} role="group" aria-label={`Année ${i.annee}`}>
                <p className="mb-1 text-sm font-medium">{i.annee} · {i.niveau}</p>
                <div className="flex flex-wrap gap-2">
                  {i.semestres.map((s) => {
                    const actif = choix?.inscriptionId === i.inscriptionId && choix.semestre === s.semestre;
                    return (
                      <Button key={s.semestre} variant={actif ? 'default' : 'outline'} aria-pressed={actif}
                        onClick={() => setChoix({ inscriptionId: i.inscriptionId, semestre: s.semestre })}>
                        Semestre {s.semestre}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={() => window.print()} disabled={!b}>Imprimer ce bulletin</Button>
          </div>
        )}
      </div>
      {b && <BulletinVue b={b} />}
    </div>
  );
}
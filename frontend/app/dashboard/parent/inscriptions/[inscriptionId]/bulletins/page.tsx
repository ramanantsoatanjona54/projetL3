'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { HistoriqueBulletins } from '@/lib/types';
import type { BulletinDetail, ExamenDocument, ExamenIndex } from '@/lib/bulletin-types';
import { ExamenVue } from '@/components/bulletins/ExamenVue';
import { BulletinVue } from '@/components/bulletins/BulletinVue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Choix { inscriptionId: number; semestre: number }

export default function PageBulletinsParent() {
  const { inscriptionId } = useParams<{ inscriptionId: string }>();
  const { utilisateur } = useAuth();
  const [histo, setHisto] = useState<HistoriqueBulletins | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [b, setB] = useState<BulletinDetail | null>(null);
  const [examens, setExamens] = useState<ExamenIndex[]>([]);
  const [exChoisi, setExChoisi] = useState<number | null>(null);
  const [ex, setEx] = useState<ExamenDocument | null>(null);
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
    api.get<ExamenIndex[]>(`/parent/inscriptions/${inscriptionId}/bulletins/examens`)
      .then(setExamens)
      .catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId]);

  useEffect(() => {
    setEx(null);
    if (exChoisi === null) return;
    api.get<ExamenDocument>(`/parent/inscriptions/${inscriptionId}/bulletins/examens/${exChoisi}`)
      .then((r) => { setEx(r); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId, exChoisi]);

  useEffect(() => {
    if (!choix) return;
    setB(null);
    api.get<BulletinDetail>(`/parent/inscriptions/${choix.inscriptionId}/bulletins/${choix.semestre}`)
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
        {histo && histo.inscriptions.length === 0 && examens.length === 0 && (
          <Alert role="status"><AlertDescription>Aucun bulletin n&apos;est publié pour le moment. Vous serez prévenu(e) dès que l&apos;école le mettra à disposition.</AlertDescription></Alert>
        )}

        {histo && histo.inscriptions.length > 0 && (
          <div className="mb-4 space-y-3">
            {histo.inscriptions.map((i) => (
              <div key={i.inscriptionId} role="group" aria-label={`Année ${i.annee}`}>
                <p className="mb-1 text-sm font-medium">{i.annee} · {i.niveau}</p>
                <div className="flex flex-wrap gap-2">
                  {i.semestres.map((s) => {
                    const actif = exChoisi === null && choix?.inscriptionId === i.inscriptionId && choix.semestre === s.semestre;
                    return (
                      <Button key={s.semestre} variant={actif ? 'default' : 'outline'} aria-pressed={actif}
                        onClick={() => { setExChoisi(null); setChoix({ inscriptionId: i.inscriptionId, semestre: s.semestre }); }}>
                        Semestre {s.semestre}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {examens.length > 0 && (
          <div className="mb-4" role="group" aria-label="Examens blancs">
            <p className="mb-1 text-sm font-medium">Examens blancs</p>
            <div className="flex flex-wrap gap-2">
              {examens.map((x) => (
                <Button key={x.numero} variant={exChoisi === x.numero ? 'default' : 'outline'} aria-pressed={exChoisi === x.numero} onClick={() => setExChoisi(x.numero)}>
                  Examen n°{x.numero}
                </Button>
              ))}
            </div>
          </div>
        )}
        {(histo?.inscriptions.length ?? 0) + examens.length > 0 && (
          <Button variant="outline" className="mb-4" onClick={() => window.print()} disabled={exChoisi !== null ? !ex : !b}>Imprimer ce document</Button>
        )}
      </div>
      {exChoisi !== null ? (ex && <ExamenVue d={ex} />) : b && <BulletinVue b={b} />}
    </div>
  );
}
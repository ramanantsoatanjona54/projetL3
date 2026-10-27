'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { Bulletin } from '@/lib/types';
import { BulletinVue } from '@/components/bulletins/BulletinVue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX = 1000;

export default function PageBulletinEleve() {
  const { inscriptionId, semestre } = useParams<{ inscriptionId: string; semestre: string }>();
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);
  const peutRediger = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);
  const peutPublier = role === 'ADMIN' || role === 'DIRECTRICE';

  const [b, setB] = useState<Bulletin | null>(null);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    api.get<Bulletin>(`/bulletins/${inscriptionId}?semestre=${semestre}`)
      .then((r) => { setB(r); setTexte(r.appreciation ?? ''); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId, semestre]);
  useEffect(() => { if (autorise) charger(); }, [autorise, charger]);

  async function enregistrer() {
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      await api.patch(`/bulletins/${inscriptionId}/appreciation`, { semestre: Number(semestre), appreciation: texte });
      setInfo('Appréciation enregistrée.');
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function publier(publie: boolean) {
    if (!publie && !window.confirm('Dépublier ce bulletin ? Les parents ne le verront plus.')) return;
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      const r = await api.post<{ publie: boolean; parentsPrevenus: number }>(`/bulletins/${inscriptionId}/publication`, { semestre: Number(semestre), publie });
      setInfo(publie ? `Bulletin publié : ${r.parentsPrevenus} parent(s) prévenu(s).` : 'Bulletin dépublié.');
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe de l&apos;école.</AlertDescription></Alert>;
  }
  const modifie = (b?.appreciation ?? '') !== texte;

  return (
    <div>
      <div className="no-print">
        <Link href="/dashboard/bulletins" className="text-sm underline underline-offset-4">← Retour à la classe</Link>
        <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Bulletin · semestre {semestre}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {b && (b.publie ? <Badge>Publié aux parents</Badge> : <Badge variant="secondary">Non publié</Badge>)}
            {peutPublier && b && (b.publie
              ? <Button variant="outline" onClick={() => publier(false)} disabled={enCours}>Dépublier</Button>
              : <Button onClick={() => publier(true)} disabled={enCours || !b.appreciation}>Publier</Button>)}
            <Button variant="outline" onClick={() => window.print()} disabled={!b}>Imprimer</Button>
          </div>
        </div>

        {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
        <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
        {peutPublier && b && !b.appreciation && (
          <Alert role="status" className="mb-4"><AlertDescription>La publication est possible une fois l&apos;appréciation rédigée par l&apos;enseignant.</AlertDescription></Alert>
        )}

        {peutRediger && b && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <Label htmlFor="appreciation" className="text-base">Appréciation générale</Label>
            <Textarea
              id="appreciation" value={texte} onChange={(e) => { setInfo(null); setTexte(e.target.value); }}
              maxLength={MAX} rows={5}  className="mt-2 text-base"
              aria-describedby="appr-aide"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p id="appr-aide" className="text-sm text-muted-foreground">
                {b.publie ? `Bulletin publié : vos modifications sont visibles tout de suite par les parents. ${texte.length} / ${MAX}` : `${texte.length} / ${MAX} caractères`}
              </p>
              <Button size="lg" onClick={enregistrer} disabled={enCours ||  !modifie}>{enCours ? 'Enregistrement...' : 'Enregistrer'}</Button>
            </div>
          </div>
        )}
      </div>

      {b ? <BulletinVue b={b} /> : !erreur && <p className="text-muted-foreground">Chargement...</p>}
    </div>
  );
}
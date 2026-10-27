'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateHeure } from '@/lib/audit';
import type { RemarqueDuParent } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX = 1000;

export default function RemarquesParent() {
  const [texte, setTexte] = useState('');
  const [liste, setListe] = useState<RemarqueDuParent[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    api.get<RemarqueDuParent[]>('/parent/remarques').then(setListe).catch((e) => setErreur(messageErreur(e)));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreur(null); setInfo(null);
    if (texte.trim().length < 10) { setErreur('La remarque doit contenir au moins 10 caractères.'); return; }
    setEnCours(true);
    try {
      await api.post('/parent/remarques', { contenu: texte.trim() });
      setInfo("Votre remarque a été transmise à la direction.");
      setTexte('');
      charger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground hover:underline">&larr; Mes enfants</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">Remarques à la direction</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Une question, une suggestion, un souci ? Écrivez-le ici. Vous serez prévenu(e) quand l&apos;école l&apos;aura prise en compte.
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      <form onSubmit={envoyer} className="mb-10 space-y-3 rounded-lg border border-border bg-card p-5">
        <Label htmlFor="remarque" className="text-base">Votre message *</Label>
        <Textarea id="remarque" rows={5} maxLength={MAX} value={texte} onChange={(e) => setTexte(e.target.value)} className="text-base" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">{texte.length} / {MAX}</span>
          <Button type="submit" size="lg" disabled={enCours || texte.trim().length < 10}>
            {enCours ? 'Envoi...' : 'Envoyer'}
          </Button>
        </div>
      </form>

      <h2 className="mb-3 text-xl font-semibold">Mes remarques envoyées</h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {liste && liste.length === 0 && <li className="px-4 py-8 text-center text-muted-foreground">Vous n&apos;avez encore envoyé aucune remarque.</li>}
        {liste?.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm tabular-nums text-muted-foreground">{dateHeure(r.date)}</span>
              <Badge variant={r.traitee ? 'secondary' : 'outline'}>{r.traitee ? 'Prise en compte' : 'En attente'}</Badge>
            </div>
            <p className="whitespace-pre-wrap">{r.contenu}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
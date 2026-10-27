'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateHeure } from '@/lib/audit';
import type { PageRemarques } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TOUS = 'tous';

export default function RemarquesDirection() {
  const { utilisateur } = useAuth();
  const autorise = utilisateur?.role === 'ADMIN' || utilisateur?.role === 'DIRECTRICE';

  const [filtre, setFiltre] = useState('non');
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<PageRemarques | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const charger = useCallback(() => {
    if (!autorise) return;
    const p = new URLSearchParams({ page: String(page), taille: '25' });
    if (filtre !== TOUS) p.set('traitee', filtre);
    api.get<PageRemarques>(`/remarques?${p.toString()}`)
      .then((d) => { setDonnees(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [autorise, page, filtre]);

  useEffect(() => { setDonnees(null); charger(); }, [charger]);

  async function changer(id: number, action: 'traitee' | 'rouvrir') {
    setInfo(null); setErreur(null);
    try {
      await api.patch(`/remarques/${id}/${action}`, {});
      setInfo(action === 'traitee' ? 'Remarque marquée comme traitée. Le parent a été prévenu.' : 'Remarque rouverte.');
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
      charger();
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à la direction.</AlertDescription></Alert>;
  }

  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.taille)) : 1;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-3xl font-semibold">Remarques des parents</h1>
      <p className="mb-6 text-sm text-muted-foreground">Marquez une remarque comme traitée : le parent en est informé.</p>

      <div className="mb-4 w-56 space-y-1.5">
        <Label htmlFor="rem-filtre" className="text-base">Afficher</Label>
        <Select value={filtre} onValueChange={(v) => { setFiltre(v); setPage(1); }}>
          <SelectTrigger id="rem-filtre" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="non">À traiter</SelectItem>
            <SelectItem value="oui">Traitées</SelectItem>
            <SelectItem value={TOUS}>Toutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">{donnees ? `${donnees.total} remarque(s)` : 'Chargement...'}</p>

      <ul className="space-y-3">
        {donnees && donnees.lignes.length === 0 && (
          <li className="rounded-lg border border-border bg-card px-4 py-10 text-center text-muted-foreground">Aucune remarque.</li>
        )}
        {donnees?.lignes.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.parent.prenom} {r.parent.nom} <span className="font-normal text-muted-foreground">· {r.parent.telephone}</span></p>
                {r.enfants.length > 0 && <p className="text-sm text-muted-foreground">Enfant(s) : {r.enfants.join(', ')}</p>}
                <p className="text-sm tabular-nums text-muted-foreground">{dateHeure(r.date)}</p>
              </div>
              <Badge variant={r.traitee ? 'secondary' : 'outline'}>{r.traitee ? 'Traitée' : 'À traiter'}</Badge>
            </div>
            <p className="mb-3 whitespace-pre-wrap">{r.contenu}</p>
            {r.traitee ? (
              <Button size="sm" variant="ghost" onClick={() => changer(r.id, 'rouvrir')}>Rouvrir</Button>
            ) : (
              <Button size="sm" onClick={() => changer(r.id, 'traitee')} aria-label={`Marquer comme traitée la remarque de ${r.parent.prenom} ${r.parent.nom}`}>
                Marquer comme traitée
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Page {page} sur {pages}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
        </div>
      </div>
    </div>
  );
}
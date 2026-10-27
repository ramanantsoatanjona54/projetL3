'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateHeure } from '@/lib/audit';
import { LIBELLE_TYPE_ARTICLE } from '@/lib/inventaire';
import type { HistoriqueInventaire } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function HistoriqueArticle() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [d, setD] = useState<HistoriqueInventaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => {
    api.get<HistoriqueInventaire>(`/inventaire/${id}/historique?page=${page}&taille=25`)
      .then((r) => { setD(r); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [id, page]);
  useEffect(() => { charger(); }, [charger]);

  const pages = d ? Math.max(1, Math.ceil(d.total / d.taille)) : 1;

  return (
    <div>
      <Link href="/dashboard/inventaire" className="text-sm text-muted-foreground hover:underline">&larr; Inventaire</Link>
      {erreur && <Alert variant="destructive" role="alert" className="mt-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!d && !erreur && <p className="mt-4 text-muted-foreground">Chargement...</p>}

      {d && (
        <>
          <h1 className="mb-1 mt-2 text-3xl font-semibold">{d.article.libelle}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {LIBELLE_TYPE_ARTICLE[d.article.type]} · stock actuel : <strong className="tabular-nums">{d.article.quantite.toLocaleString('fr-FR')}</strong>
          </p>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Mouvement</TableHead>
                  <TableHead className="text-right">Quantité</TableHead><TableHead>Motif</TableHead><TableHead>Par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.lignes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Aucun mouvement.</TableCell></TableRow>
                ) : d.lignes.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{dateHeure(m.date)}</TableCell>
                    <TableCell><Badge variant={m.type === 'ENTREE' ? 'secondary' : 'outline'}>{m.type === 'ENTREE' ? 'Entrée' : 'Sortie'}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{m.type === 'ENTREE' ? '+' : '−'}{m.quantite.toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="text-sm">{m.motif ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.par}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Page {page} sur {pages} · {d.total} mouvement(s)</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
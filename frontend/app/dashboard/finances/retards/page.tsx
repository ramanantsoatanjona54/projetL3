'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { ar } from '@/lib/format';
import type { LigneRetard } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export default function Retards() {
  const [data, setData] = useState<{ annee: { libelle: string } | null; lignes: LigneRetard[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ annee: { libelle: string } | null; lignes: LigneRetard[] }>('/finances/retards')
      .then(setData)
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  }, []);

  const total = data?.lignes.reduce((s, l) => s + l.montantDu + l.penalites, 0) ?? 0;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Retards de paiement</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {data
          ? data.annee
            ? `${data.annee.libelle} · ${data.lignes.length} élève(s) en retard · ${ar(total)} à recouvrer (pénalités comprises)`
            : "Aucune année scolaire en cours."
          : 'Chargement...'}
      </p>

      {erreur && <Alert variant="destructive"><AlertDescription>{erreur}</AlertDescription></Alert>}

      {data && (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead><TableHead>Salle</TableHead><TableHead>Mois impayés</TableHead>
                <TableHead>À payer</TableHead><TableHead>Contact parent</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lignes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Aucun retard de paiement.</TableCell></TableRow>
              ) : data.lignes.map((l) => (
                <TableRow key={l.inscriptionId}>
                  <TableCell className="font-medium">{l.eleve.nom.toUpperCase()} {l.eleve.prenom}</TableCell>
                  <TableCell>{l.niveau.nom} · {l.salle.nom}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {l.moisEnRetard.map((m) => <Badge key={m} variant="destructive">{MOIS[m - 1]}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {ar(l.montantDu + l.penalites)}
                    <span className="block text-sm text-muted-foreground">dont {ar(l.penalites)} de pénalité</span>
                  </TableCell>
                  <TableCell>
                    {l.eleve.parents.length === 0 ? '—' : l.eleve.parents.map((p) => (
                      <span key={p.parent.telephone} className="block text-sm">{p.parent.prenom} {p.parent.nom} : {p.parent.telephone}</span>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm"><Link href={`/dashboard/inscriptions/${l.inscriptionId}/paiements`}>Encaisser</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
'use client';

import { useEffect, useMemo, useState , useCallback } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { normaliser } from '@/lib/normaliser';
import type { Eleve } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useActualisationAuto } from '@/lib/useActualisationAuto';
import { useAuth } from '@/context/AuthContext';

export default function ElevesPage() {
  const [eleves, setEleves] = useState<Eleve[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const { utilisateur } = useAuth();

  const charger = useCallback(() => {
    api.get<Eleve[] | { data: Eleve[] }>('/eleves')
      .then((r) => { setEleves(Array.isArray(r) ? r : r.data); setErreur(null); })
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible.'));
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useActualisationAuto(charger);

  const filtres = useMemo(() => {
    if (!eleves) return [];
    const q = normaliser(recherche);
    if (!q) return eleves;
    return eleves.filter((e) => normaliser(`${e.nom} ${e.prenom} ${e.matricule}`).includes(q));
  }, [eleves, recherche]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Élèves</h1>
          <p className="text-sm text-muted-foreground">
            {eleves ? `${filtres.length} élève(s) affiché(s) sur ${eleves.length}` : 'Chargement...'}
          </p>
        </div>
                {utilisateur?.role === 'ADMIN' && (
          <Button asChild size="lg"><Link href="/dashboard/eleves/nouveau">Nouvel élève</Link></Button>
        )}
      </div>

      <Input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher par nom, prénom ou matricule"
        aria-label="Rechercher un élève"
        className="mb-4 h-11 max-w-md text-base"
      />

      {erreur && <Alert variant="destructive"><AlertDescription>{erreur}</AlertDescription></Alert>}

      {eleves && (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom et prénom</TableHead>
                <TableHead>Sexe</TableHead>
                <TableHead>Naissance</TableHead>
                <TableHead className="hidden md:table-cell">Quartier</TableHead>
                <TableHead className="hidden md:table-cell">Téléphone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtres.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {recherche ? 'Aucun élève ne correspond à cette recherche.' : 'Aucun élève enregistré.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtres.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-sm">{e.matricule}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/eleves/${e.id}`} className="hover:text-primary hover:underline">
                        {e.nom.toUpperCase()} {e.prenom}
                      </Link>
                    </TableCell>
                    <TableCell>{e.sexe}</TableCell>
                    <TableCell>{new Date(e.dateNaissance).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="hidden md:table-cell">{e.quartier ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">{e.telephone ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
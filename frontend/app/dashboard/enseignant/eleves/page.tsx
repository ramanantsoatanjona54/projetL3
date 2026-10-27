'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { dateFr } from '@/lib/format';
import { messageErreur } from '@/lib/messages';
import type { EleveSalle } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MesEleves() {
  const { utilisateur } = useAuth();
  const autorise = utilisateur?.role === 'ENSEIGNANT';
  const [d, setD] = useState<{ salle: { id: number; nom: string } | null; eleves: EleveSalle[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [niveau, setNiveau] = useState('tous');
    const [avecAbsences, setAvecAbsences] = useState(false);
  useEffect(() => {
    if (!autorise) return;
    api.get<{ avecAbsences: boolean }>('/enseignant/profil')
      .then((p) => setAvecAbsences(p.avecAbsences))
      .catch(() => setAvecAbsences(false));
  }, [autorise]);

  useEffect(() => {
    if (!autorise) return;
    api.get<{ salle: { id: number; nom: string } | null; eleves: EleveSalle[] }>('/enseignant/eleves')
      .then(setD).catch((e) => setErreur(messageErreur(e)));
  }, [autorise]);

  const niveaux = useMemo(() => [...new Set((d?.eleves ?? []).map((e) => e.niveau))], [d]);
  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (d?.eleves ?? []).filter(
      (e) => (niveau === 'tous' || e.niveau === niveau) && (!q || `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(q)),
    );
  }, [d, recherche, niveau]);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cet espace est réservé aux enseignants.</AlertDescription></Alert>;
  }
  if (erreur) return <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>;
  if (!d) return <p className="text-muted-foreground">Chargement...</p>;
  if (!d.salle) return <Alert role="status"><AlertDescription>Aucune salle ne vous est affectée.</AlertDescription></Alert>;

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Mes élèves</h1>
      <p className="mb-4 text-sm text-muted-foreground">Salle {d.salle.nom} · {d.eleves.length} élève(s)</p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64 space-y-1.5">
          <Label htmlFor="rech" className="text-base">Rechercher</Label>
          <Input id="rech" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, prénom ou matricule" className="h-11 text-base" />
        </div>
        {niveaux.length > 1 && (
          <div className="w-40 space-y-1.5">
            <Label htmlFor="niv" className="text-base">Niveau</Label>
            <Select value={niveau} onValueChange={setNiveau}>
              <SelectTrigger id="niv" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous</SelectItem>
                {niveaux.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {liste.length === 0 ? (
        <Alert role="status"><AlertDescription>Aucun élève ne correspond.</AlertDescription></Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                  <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead><TableHead>Niveau</TableHead><TableHead>Né(e) le</TableHead>
                {avecAbsences && <TableHead>Absences</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {liste.map((e) => (
                <TableRow key={e.inscriptionId}>
                  <TableCell className="font-medium">{e.prenom} {e.nom}<span className="block text-xs font-normal text-muted-foreground">{e.matricule}</span></TableCell>
                  <TableCell>{e.niveau}</TableCell>
                  <TableCell>{dateFr(e.dateNaissance)}</TableCell>
                  {avecAbsences && (
                    <TableCell>
                      {e.absences === 0 ? <span className="text-muted-foreground">Aucune</span> : (
                        <>
                          {e.absences}
                          {e.nonJustifiees > 0 && <Badge variant="secondary" className="ml-2">{e.nonJustifiees} non justifiée(s)</Badge>}
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
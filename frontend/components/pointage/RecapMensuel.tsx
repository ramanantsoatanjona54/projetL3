'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { ar, nomMois } from '@/lib/format';
import { nomComplet } from '@/lib/personnel';
import { duree, moisCourant } from '@/lib/pointage';
import type { RecapMois } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function RecapMensuel() {
  const [mois, setMois] = useState(moisCourant());
  const [donnees, setDonnees] = useState<RecapMois | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!mois) return;
    setDonnees(null);
    api.get<RecapMois>(`/rh/presences/mois?mois=${mois}`)
      .then((d) => { setDonnees(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [mois]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="space-y-1.5">
          <Label htmlFor="mois" className="text-base">Mois</Label>
          <Input id="mois" type="month" value={mois} max={moisCourant()} onChange={(e) => setMois(e.target.value)} className="h-11 text-base" />
        </div>
        <Button variant="outline" onClick={() => window.print()}>Imprimer</Button>
      </div>

      <h2 className="mb-1 text-xl font-semibold capitalize">{mois ? nomMois(`${mois}-01`) : ''}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {donnees ? `${donnees.joursOuvresMois} jour(s) ouvré(s) (lundi à vendredi).` : 'Chargement...'}
        {' '}Les jours fériés ne sont pas pris en compte : ils comptent comme des absences.
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Jours ouvrés</TableHead>
              <TableHead className="text-right">Présences</TableHead>
              <TableHead className="text-right">Absences</TableHead>
              <TableHead className="text-right">Départs non pointés</TableHead>
              <TableHead className="text-right">Heures</TableHead>
              <TableHead className="text-right">Indemnité de transport (indicative)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!donnees ? null : donnees.agents.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Aucun agent en poste ce mois-ci.</TableCell></TableRow>
            ) : donnees.agents.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className="font-medium">{nomComplet(a)}</span>
                  <span className="block text-sm text-muted-foreground">{a.poste} · {a.matricule}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.joursOuvres}</TableCell>
                <TableCell className="text-right tabular-nums">{a.joursPresents}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.absences > 0 ? <Badge variant="secondary">{a.absences}</Badge> : 0}
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.departsOublies}</TableCell>
                <TableCell className="text-right tabular-nums">{duree(a.minutesTravaillees)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.indemniteTransport != null ? ar(a.indemniteTransport) : <span className="text-muted-foreground">Non renseignée</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
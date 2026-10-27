'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { ar } from '@/lib/format';
import type { LigneRetard } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

type Donnees = { annee: { libelle: string } | null; lignes: LigneRetard[] };

export default function Retards() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;

  const [data, setData] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [cible, setCible] = useState<LigneRetard | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [rappeles, setRappeles] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get<Donnees>('/finances/retards')
      .then(setData)
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  const total = data?.lignes.reduce((s, l) => s + l.montantDu + l.penalites, 0) ?? 0;

  async function envoyerRappel() {
    if (!cible) return;
    setEnCours(true);
    setErreurModale(null);
    try {
      const r = await api.post<{ envoyes: number }>(`/finances/retards/${cible.inscriptionId}/rappel`, {});
      setRappeles((prev) => new Set(prev).add(cible.inscriptionId));
      setSucces(
        `Rappel envoyé à ${r.envoyes} parent(s) de ${cible.eleve.prenom} ${cible.eleve.nom}.`,
      );
      setCible(null);
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Retards de paiement</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {data
          ? data.annee
            ? `${data.annee.libelle} · ${data.lignes.length} élève(s) en retard · ${ar(total)} à recouvrer (pénalités comprises)`
            : 'Aucune année scolaire en cours.'
          : 'Chargement...'}
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {succes && <Alert role="status" className="mb-4"><AlertDescription>{succes}</AlertDescription></Alert>}

      {data && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead><TableHead>Salle</TableHead><TableHead>Mois impayés</TableHead>
                <TableHead>À payer</TableHead><TableHead>Contact parent</TableHead>
                <TableHead className="text-right">Action</TableHead>
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
                    {role === 'SECRETARIAT' && (
                      <Button asChild size="sm">
                        <Link href={`/dashboard/inscriptions/${l.inscriptionId}/paiements`}>Encaisser</Link>
                      </Button>
                    )}
                    {role === 'DIRECTRICE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rappeles.has(l.inscriptionId)}
                        onClick={() => { setSucces(null); setErreurModale(null); setCible(l); }}
                      >
                        {rappeles.has(l.inscriptionId) ? 'Rappel envoyé' : 'Rappeler'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ModaleCrud
        ouvert={cible !== null}
        titre="Envoyer un rappel de paiement"
        description={
          cible
            ? `Les parents de ${cible.eleve.prenom} ${cible.eleve.nom} recevront une notification : ${ar(cible.montantDu + cible.penalites)} à régler, pénalités comprises. Un seul rappel est possible par jour.`
            : ''
        }
        libelleValider="Envoyer le rappel"
        enCours={enCours}
        erreur={erreurModale}
        onFermer={() => setCible(null)}
        onValider={envoyerRappel}
      />
    </div>
  );
}
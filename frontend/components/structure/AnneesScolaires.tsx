'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import type { AnneeScolaire } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from './ModaleCrud';
import { ChampTexte } from './ChampTexte';

type Modale =
  | { type: 'creer' }
  | { type: 'modifier'; a: AnneeScolaire }
  | { type: 'supprimer'; a: AnneeScolaire }
  | null;

const jour = (iso: string) => iso.slice(0, 10);

function statut(a: AnneeScolaire) {
  const now = new Date();
  if (now < new Date(a.dateDebut)) return { label: 'À venir', variant: 'outline' as const };
  if (now > new Date(a.dateFin)) return { label: 'Terminée', variant: 'secondary' as const };
  return { label: 'En cours', variant: 'default' as const };
}

export function AnneesScolaires({ annees, onChange }: { annees: AnneeScolaire[]; onChange: () => void }) {
  const [modale, setModale] = useState<Modale>(null);
  const [libelle, setLibelle] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function ouvrir(m: Modale) {
    setErreurs({});
    setErreur(null);
    if (m?.type === 'modifier') {
      setLibelle(m.a.libelle); setDebut(jour(m.a.dateDebut)); setFin(jour(m.a.dateFin));
    } else {
      setLibelle(''); setDebut(''); setFin('');
    }
    setModale(m);
  }

  // À la création, le libellé « 2026-2027 » est proposé à partir des dates
  function majDates(d: string, f: string) {
    setDebut(d);
    setFin(f);
    if (modale?.type === 'creer' && (libelle === '' || /^\d{4}-\d{4}$/.test(libelle)) && d && f) {
      setLibelle(`${d.slice(0, 4)}-${f.slice(0, 4)}`);
    }
  }

  function valider() {
    const e: Record<string, string> = {};
    if (!libelle.trim()) e.libelle = 'Indiquez le libellé (ex. 2026-2027).';
    if (!debut) e.debut = 'Indiquez la date de début.';
    if (!fin) e.fin = 'Indiquez la date de fin.';
    if (debut && fin && fin <= debut) e.fin = 'La date de fin doit être après la date de début.';
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function envoyer() {
    if (!modale) return;
    if (modale.type !== 'supprimer' && !valider()) return;
    setEnCours(true);
    setErreur(null);
    try {
      const body = { libelle: libelle.trim(), dateDebut: debut, dateFin: fin };
      if (modale.type === 'creer') await api.post('/structure/annees-scolaires', body);
      else if (modale.type === 'modifier') await api.patch(`/structure/annees-scolaires/${modale.a.id}`, body);
      else await api.delete(`/structure/annees-scolaires/${modale.a.id}`);
      setModale(null);
      onChange();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const suppression = modale?.type === 'supprimer';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Une année scolaire définit la période des inscriptions et des échéances de paiement.</p>
        <Button onClick={() => ouvrir({ type: 'creer' })}>Nouvelle année scolaire</Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead><TableHead>Début</TableHead><TableHead>Fin</TableHead>
              <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {annees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucune année scolaire. Créez-en une pour pouvoir inscrire des élèves.
                </TableCell>
              </TableRow>
            ) : annees.map((a) => {
              const s = statut(a);
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.libelle}</TableCell>
                  <TableCell>{dateFr(a.dateDebut)}</TableCell>
                  <TableCell>{dateFr(a.dateFin)}</TableCell>
                  <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => ouvrir({ type: 'modifier', a })}>Modifier</Button>
                      <Button size="sm" variant="ghost" onClick={() => ouvrir({ type: 'supprimer', a })}>Supprimer</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={!!modale}
        titre={suppression ? "Supprimer l'année scolaire" : modale?.type === 'modifier' ? "Modifier l'année scolaire" : 'Nouvelle année scolaire'}
        description={suppression ? 'Cette action est définitive.' : "Les dates ne doivent chevaucher aucune autre année."}
        libelleValider={suppression ? 'Supprimer' : 'Enregistrer'}
        destructif={suppression}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setModale(null); }} onValider={envoyer}
      >
        {suppression && modale?.type === 'supprimer' ? (
          <p className="text-base">Supprimer l&apos;année <strong>{modale.a.libelle}</strong> ? Elle ne peut l&apos;être que si rien n&apos;y est rattaché.</p>
        ) : (
          <>
            <ChampTexte id="a-debut" label="Date de début *" type="date" value={debut} onChange={(v) => majDates(v, fin)} erreur={erreurs.debut} />
            <ChampTexte id="a-fin" label="Date de fin *" type="date" value={fin} onChange={(v) => majDates(debut, v)} erreur={erreurs.fin} />
            <ChampTexte id="a-libelle" label="Libellé *" value={libelle} onChange={setLibelle} erreur={erreurs.libelle} placeholder="2026-2027" />
          </>
        )}
      </ModaleCrud>
    </div>
  );
}
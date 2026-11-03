'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { normaliser } from '@/lib/normaliser';
import type { Classe } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from './ModaleCrud';
import { ChampTexte } from './ChampTexte';

type Modale = { type: 'creer' } | { type: 'modifier'; c: Classe } | { type: 'supprimer'; c: Classe } | null;

const CYCLES = [
  { valeur: 'prescolaire', libelle: 'Préscolaire' },
  { valeur: 'primaire_1', libelle: 'Primaire 1' },
  { valeur: 'primaire_2', libelle: 'Primaire 2' },
  { valeur: 'college', libelle: 'Collège' },
];
const libelleCycle = (v?: string) => CYCLES.find((c) => c.valeur === v)?.libelle ?? '—';

export function Classes({ classes, onChange }: { classes: Classe[]; onChange: () => void }) {
  const [modale, setModale] = useState<Modale>(null);
  const [nom, setNom] = useState('');
  const [ordre, setOrdre] = useState('1');
  const [cycle, setCycle] = useState('prescolaire');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function ouvrir(m: Modale) {
    setErreurs({});
    setErreur(null);
    if (m?.type === 'modifier') {
      setNom(m.c.nom);
      setOrdre(String(m.c.ordre));
      setCycle(m.c.cycle ?? 'prescolaire');
    } else {
      setNom('');
      setOrdre(String(Math.max(0, ...classes.map((c) => c.ordre)) + 1));
      setCycle('prescolaire');
    }
    setModale(m);
  }

  function valider() {
    const e: Record<string, string> = {};
    const idCourant = modale?.type === 'modifier' ? modale.c.id : null;
    const autres = classes.filter((c) => c.id !== idCourant);
    const o = Number(ordre);
    if (!nom.trim()) e.nom = 'Indiquez le nom de la classe.';
    else if (autres.some((c) => normaliser(c.nom) === normaliser(nom))) e.nom = 'Une classe porte déjà ce nom.';
    if (!Number.isInteger(o) || o < 1) e.ordre = "L'ordre doit être un entier supérieur ou égal à 1.";
    else if (autres.some((c) => c.ordre === o)) e.ordre = 'Cet ordre est déjà utilisé par une autre classe.';
    if (!CYCLES.some((c) => c.valeur === cycle)) e.cycle = 'Choisissez un cycle.';
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function envoyer() {
    if (!modale) return;
    if (modale.type !== 'supprimer' && !valider()) return;
    setEnCours(true);
    setErreur(null);
    try {
      const body = { nom: nom.trim(), ordre: Number(ordre), cycle };
      if (modale.type === 'creer') await api.post('/structure/classes', body);
      else if (modale.type === 'modifier') await api.patch(`/structure/classes/${modale.c.id}`, body);
      else await api.delete(`/structure/classes/${modale.c.id}`);
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
        <p className="text-sm text-muted-foreground">Les classes regroupent les niveaux (ex. Maternelle, Primaire). L&apos;ordre fixe leur tri.</p>
        <Button onClick={() => ouvrir({ type: 'creer' })}>Nouvelle classe</Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Ordre</TableHead><TableHead>Nom</TableHead><TableHead>Cycle</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Aucune classe. Commencez par en créer une.</TableCell></TableRow>
            ) : classes.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.ordre}</TableCell>
                <TableCell className="font-medium">{c.nom}</TableCell>
                <TableCell>{libelleCycle(c.cycle)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => ouvrir({ type: 'modifier', c })}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => ouvrir({ type: 'supprimer', c })}>Supprimer</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={!!modale}
        titre={suppression ? 'Supprimer la classe' : modale?.type === 'modifier' ? 'Modifier la classe' : 'Nouvelle classe'}
        description={suppression ? 'Cette action est définitive.' : 'Le nom et l’ordre doivent être uniques.'}
        libelleValider={suppression ? 'Supprimer' : 'Enregistrer'}
        destructif={suppression}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setModale(null); }} onValider={envoyer}
      >
        {suppression && modale?.type === 'supprimer' ? (
          <p className="text-base">Supprimer la classe <strong>{modale.c.nom}</strong> ? Elle ne peut l&apos;être que si elle n&apos;a plus de niveau.</p>
        ) : (
          <>
            <ChampTexte id="c-nom" label="Nom *" value={nom} onChange={setNom} erreur={erreurs.nom} />
            <ChampTexte id="c-ordre" label="Ordre *" type="number" value={ordre} onChange={setOrdre} erreur={erreurs.ordre} />
            <div className="space-y-1.5">
              <Label htmlFor="c-cycle" className="text-base">Cycle *</Label>
              <Select value={cycle} onValueChange={setCycle}>
                <SelectTrigger id="c-cycle" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => <SelectItem key={c.valeur} value={c.valeur}>{c.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
              {erreurs.cycle && <p className="text-sm text-destructive">{erreurs.cycle}</p>}
            </div>
          </>
        )}
      </ModaleCrud>
    </div>
  );
}
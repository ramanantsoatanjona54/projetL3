'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { normaliser } from '@/lib/normaliser';
import type { AnneeScolaire, Niveau, Salle } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from './ModaleCrud';
import { ChampTexte } from './ChampTexte';

type Modale = { type: 'creer' } | { type: 'modifier'; s: Salle } | { type: 'supprimer'; s: Salle } | null;
const TOUTES = 'toutes';

interface Props { salles: Salle[]; annees: AnneeScolaire[]; niveaux: Niveau[]; onChange: () => void }

export function Salles({ salles, annees, niveaux, onChange }: Props) {
  const [modale, setModale] = useState<Modale>(null);
  const [nom, setNom] = useState('');
  const [anneeId, setAnneeId] = useState(TOUTES);
  const [ids, setIds] = useState<number[]>([]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const parClasse = useMemo(() => {
    const m = new Map<string, Niveau[]>();
    for (const n of niveaux) {
      const k = n.classe?.nom ?? 'Autres';
      m.set(k, [...(m.get(k) ?? []), n]);
    }
    return [...m.entries()];
  }, [niveaux]);

  const libelleAnnee = (id: number | null) => (id ? annees.find((a) => a.id === id)?.libelle ?? '—' : 'Toutes les années');

  function ouvrir(m: Modale) {
    setErreurs({});
    setErreur(null);
    if (m?.type === 'modifier') {
      setNom(m.s.nom);
      setAnneeId(m.s.anneeScolaireId ? String(m.s.anneeScolaireId) : TOUTES);
      setIds((m.s.niveaux ?? []).map((n) => n.id));
    } else {
      setNom(''); setAnneeId(TOUTES); setIds([]);
    }
    setModale(m);
  }

  const basculer = (id: number) =>
    setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function valider() {
    const e: Record<string, string> = {};
    const idCourant = modale?.type === 'modifier' ? modale.s.id : null;
    const annee = anneeId === TOUTES ? null : Number(anneeId);
    if (!nom.trim()) e.nom = 'Indiquez le nom de la salle.';
    else if (salles.some((s) => s.id !== idCourant && normaliser(s.nom) === normaliser(nom) && (s.anneeScolaireId ?? null) === annee)) {
      e.nom = 'Une salle porte déjà ce nom pour cette année.';
    }
    if (ids.length === 0) e.niveaux = 'Cochez au moins un niveau accueilli.';
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function envoyer() {
    if (!modale) return;
    if (modale.type !== 'supprimer' && !valider()) return;
    setEnCours(true);
    setErreur(null);
    try {
      const annee = anneeId === TOUTES ? null : Number(anneeId);
      if (modale.type === 'creer') {
        await api.post('/structure/salles', {
          nom: nom.trim(), niveauIds: ids, ...(annee ? { anneeScolaireId: annee } : {}),
        });
      } else if (modale.type === 'modifier') {
        await api.patch(`/structure/salles/${modale.s.id}`, { nom: nom.trim(), niveauIds: ids, anneeScolaireId: annee });
      } else {
        await api.delete(`/structure/salles/${modale.s.id}`);
      }
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {niveaux.length === 0 ? "Créez d'abord des niveaux : une salle accueille un ou plusieurs niveaux." : 'Une salle est proposée à l’inscription pour les niveaux qu’elle accueille.'}
        </p>
        <Button onClick={() => ouvrir({ type: 'creer' })} disabled={niveaux.length === 0}>Nouvelle salle</Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Salle</TableHead><TableHead>Année</TableHead><TableHead>Niveaux accueillis</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salles.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Aucune salle.</TableCell></TableRow>
            ) : salles.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nom}</TableCell>
                <TableCell>{libelleAnnee(s.anneeScolaireId)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(s.niveaux ?? []).map((n) => <Badge key={n.id} variant="secondary">{n.nom}</Badge>)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => ouvrir({ type: 'modifier', s })}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => ouvrir({ type: 'supprimer', s })}>Supprimer</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={!!modale}
        titre={suppression ? 'Supprimer la salle' : modale?.type === 'modifier' ? 'Modifier la salle' : 'Nouvelle salle'}
        description={suppression ? 'Cette action est définitive.' : 'Sans année précise, la salle est valable pour toutes les années.'}
        libelleValider={suppression ? 'Supprimer' : 'Enregistrer'}
        destructif={suppression}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setModale(null); }} onValider={envoyer}
      >
        {suppression && modale?.type === 'supprimer' ? (
          <p className="text-base">Supprimer la salle <strong>{modale.s.nom}</strong> ? Elle ne peut l&apos;être que si aucune inscription ni emploi du temps n&apos;y est rattaché.</p>
        ) : (
          <>
            <ChampTexte id="s-nom" label="Nom *" value={nom} onChange={setNom} erreur={erreurs.nom} />
            <div className="space-y-1.5">
              <Label htmlFor="s-annee" className="text-base">Année scolaire</Label>
              <Select value={anneeId} onValueChange={setAnneeId}>
                <SelectTrigger id="s-annee" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TOUTES}>Toutes les années</SelectItem>
                  {annees.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-base font-medium">Niveaux accueillis *</legend>
              {parClasse.map(([classe, liste]) => (
                <div key={classe}>
                  <p className="text-sm text-muted-foreground">{classe}</p>
                  <div className="flex flex-wrap gap-x-5">
                    {liste.map((n) => (
                      <label key={n.id} className="flex min-h-11 items-center gap-2 text-base">
                        <input type="checkbox" className="size-5 accent-primary" checked={ids.includes(n.id)} onChange={() => basculer(n.id)} />
                        {n.nom}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {erreurs.niveaux && <p className="text-sm text-destructive">{erreurs.niveaux}</p>}
            </fieldset>
          </>
        )}
      </ModaleCrud>
    </div>
  );
}
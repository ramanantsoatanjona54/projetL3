'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { normaliser } from '@/lib/normaliser';
import type { Classe, Niveau } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from './ModaleCrud';
import { ChampTexte } from './ChampTexte';

type Modale = { type: 'creer' } | { type: 'modifier'; n: Niveau } | { type: 'supprimer'; n: Niveau } | null;

export function Niveaux({ niveaux, classes, onChange }: { niveaux: Niveau[]; classes: Classe[]; onChange: () => void }) {
  const [modale, setModale] = useState<Modale>(null);
  const [classeId, setClasseId] = useState('');
  const [nom, setNom] = useState('');
  const [ordre, setOrdre] = useState('1');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const ordreSuivant = (cid: string) =>
    String(Math.max(0, ...niveaux.filter((n) => String(n.classeId) === cid).map((n) => n.ordre)) + 1);

  function ouvrir(m: Modale) {
    setErreurs({});
    setErreur(null);
    if (m?.type === 'modifier') { setClasseId(String(m.n.classeId)); setNom(m.n.nom); setOrdre(String(m.n.ordre)); }
    else { setClasseId(''); setNom(''); setOrdre('1'); }
    setModale(m);
  }

  function valider() {
    const e: Record<string, string> = {};
    const idCourant = modale?.type === 'modifier' ? modale.n.id : null;
    const o = Number(ordre);
    if (!classeId) e.classe = 'Choisissez la classe.';
    if (!nom.trim()) e.nom = 'Indiquez le nom du niveau.';
    else if (niveaux.some((n) => n.id !== idCourant && String(n.classeId) === classeId && normaliser(n.nom) === normaliser(nom))) {
      e.nom = 'Ce niveau existe déjà dans cette classe.';
    }
    if (!Number.isInteger(o) || o < 1) e.ordre = "L'ordre doit être un entier supérieur ou égal à 1.";
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function envoyer() {
    if (!modale) return;
    if (modale.type !== 'supprimer' && !valider()) return;
    setEnCours(true);
    setErreur(null);
    try {
      const body = { classeId: Number(classeId), nom: nom.trim(), ordre: Number(ordre) };
      if (modale.type === 'creer') await api.post('/structure/niveaux', body);
      else if (modale.type === 'modifier') await api.patch(`/structure/niveaux/${modale.n.id}`, body);
      else await api.delete(`/structure/niveaux/${modale.n.id}`);
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
          {classes.length === 0 ? "Créez d'abord une classe : un niveau appartient toujours à une classe." : 'Un niveau est un degré précis (ex. CP1, CE2) rattaché à une classe.'}
        </p>
        <Button onClick={() => ouvrir({ type: 'creer' })} disabled={classes.length === 0}>Nouveau niveau</Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classe</TableHead><TableHead className="w-24">Ordre</TableHead><TableHead>Niveau</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {niveaux.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Aucun niveau.</TableCell></TableRow>
            ) : niveaux.map((n) => (
              <TableRow key={n.id}>
                <TableCell>{n.classe?.nom ?? '—'}</TableCell>
                <TableCell>{n.ordre}</TableCell>
                <TableCell className="font-medium">{n.nom}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => ouvrir({ type: 'modifier', n })}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => ouvrir({ type: 'supprimer', n })}>Supprimer</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ModaleCrud
        ouvert={!!modale}
        titre={suppression ? 'Supprimer le niveau' : modale?.type === 'modifier' ? 'Modifier le niveau' : 'Nouveau niveau'}
        description={suppression ? 'Cette action est définitive.' : 'Le nom doit être unique dans sa classe.'}
        libelleValider={suppression ? 'Supprimer' : 'Enregistrer'}
        destructif={suppression}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setModale(null); }} onValider={envoyer}
      >
        {suppression && modale?.type === 'supprimer' ? (
          <p className="text-base">Supprimer le niveau <strong>{modale.n.nom}</strong> ? Il ne peut l&apos;être que si aucune inscription, aucun semestre ni emploi du temps n&apos;y est rattaché.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="n-classe" className="text-base">Classe *</Label>
              <Select
                value={classeId}
                onValueChange={(v) => {
                  setClasseId(v);
                  if (modale?.type === 'creer') setOrdre(ordreSuivant(v));
                  setErreurs((p) => ({ ...p, classe: '' }));
                }}
              >
                <SelectTrigger id="n-classe" className="h-11 w-full text-base" aria-invalid={!!erreurs.classe}>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              {erreurs.classe && <p className="text-sm text-destructive">{erreurs.classe}</p>}
            </div>
            <ChampTexte id="n-nom" label="Nom *" value={nom} onChange={setNom} erreur={erreurs.nom} />
            <ChampTexte id="n-ordre" label="Ordre dans la classe *" type="number" value={ordre} onChange={setOrdre} erreur={erreurs.ordre} />
          </>
        )}
      </ModaleCrud>
    </div>
  );
}
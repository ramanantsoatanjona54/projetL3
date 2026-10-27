'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { dateFr } from '@/lib/format';
import { messageErreur } from '@/lib/messages';
import type { ExamenListe, ListeExamens, MatiereExamen } from '@/lib/types';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Ligne { matiereId: string; coefficient: string }
type Modale = { type: 'creer' } | { type: 'modifier'; examen: ExamenListe } | { type: 'supprimer'; examen: ExamenListe } | null;

export default function PageExamensBlancs() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
    const gere = role === 'ADMIN'; // seul l'admin crée, modifie et supprime
  const autorise = gere || role === 'DIRECTRICE' || role === 'ENSEIGNANT';

  const [data, setData] = useState<ListeExamens | null>(null);
  const [matieres, setMatieres] = useState<MatiereExamen[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modale, setModale] = useState<Modale>(null);
  const [date, setDate] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(() => {
    api.get<ListeExamens>('/examens-blancs').then((d) => { setData(d); setErreur(null); }).catch((e) => setErreur(messageErreur(e)));
  }, []);

  useEffect(() => {
    if (!autorise) return;
    charger();
    if (gere) api.get<MatiereExamen[]>('/examens-blancs/matieres').then(setMatieres).catch((e) => setErreur(messageErreur(e)));
  }, [autorise, gere, charger]);

  function ouvrirCreer() {
    // Préremplit avec les disciplines du dernier examen pour éviter de tout ressaisir
    const dernier = data?.examens[data.examens.length - 1];
    setDate('');
    setLignes(dernier ? dernier.disciplines.map((d) => ({ matiereId: String(d.matiereId), coefficient: String(d.coefficient) })) : [{ matiereId: '', coefficient: '1' }]);
    setErreurModale(null);
    setModale({ type: 'creer' });
  }
  function ouvrirModifier(examen: ExamenListe) {
    setDate(examen.date);
    setLignes(examen.disciplines.map((d) => ({ matiereId: String(d.matiereId), coefficient: String(d.coefficient) })));
    setErreurModale(null);
    setModale({ type: 'modifier', examen });
  }

  function corps() {
    if (!date) return 'Indiquez la date de l’examen.';
    if (lignes.length === 0) return 'Ajoutez au moins une discipline.';
    for (const l of lignes) {
      if (!l.matiereId) return 'Choisissez une discipline pour chaque ligne.';
      if (!/^\d+$/.test(l.coefficient) || +l.coefficient < 1 || +l.coefficient > 10) return 'Le coefficient est un entier de 1 à 10.';
    }
    return null;
  }

  async function valider() {
    if (!modale) return;
    setErreurModale(null);
    setEnCours(true);
    try {
      if (modale.type === 'supprimer') {
        await api.delete(`/examens-blancs/${modale.examen.id}`);
      } else {
        const probleme = corps();
        if (probleme) { setErreurModale(probleme); return; }
        const payload = { date, disciplines: lignes.map((l) => ({ matiereId: Number(l.matiereId), coefficient: Number(l.coefficient) })) };
        if (modale.type === 'creer') await api.post('/examens-blancs', payload);
        else await api.patch(`/examens-blancs/${modale.examen.id}`, payload);
      }
      setModale(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe pédagogique.</AlertDescription></Alert>;
  }

  const choisies = new Set(lignes.map((l) => l.matiereId));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Examens blancs{data ? ` · ${data.niveau.nom}` : ''}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Notes sur 20, moyenne pondérée par les coefficients, sans classement.</p>
        </div>
        {gere && <Button size="lg" onClick={ouvrirCreer}>Nouvel examen</Button>}
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {data && data.examens.length === 0 && (
        <Alert role="status"><AlertDescription>Aucun examen blanc cette année.{gere ? ' Créez le premier avec « Nouvel examen ».' : ''}</AlertDescription></Alert>
      )}

      <ul className="space-y-3">
        {data?.examens.map((e) => (
          <li key={e.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Examen blanc n°{e.numero}</h2>
                <p className="text-sm text-muted-foreground">{dateFr(e.date)} · {e.totalNotes} note(s) saisie(s)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/examens-blancs/${e.id}`} className={buttonVariants({ variant: role === 'ENSEIGNANT' ? 'default' : 'outline' })}>
                  {role === 'ENSEIGNANT' ? 'Saisir les notes' : 'Voir les notes'}
                </Link>
                {gere && <Button variant="outline" onClick={() => ouvrirModifier(e)}>Modifier</Button>}
                {gere && <Button variant="outline" onClick={() => { setErreurModale(null); setModale({ type: 'supprimer', examen: e }); }} disabled={e.totalNotes > 0} title={e.totalNotes > 0 ? 'Contient des notes' : undefined}>Supprimer</Button>}
              </div>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {e.disciplines.map((d) => <li key={d.id}><Badge variant="outline">{d.nom} · coef. {d.coefficient}</Badge></li>)}
            </ul>
          </li>
        ))}
      </ul>

      <ModaleCrud
        ouvert={modale !== null}
        titre={modale?.type === 'creer' ? 'Nouvel examen blanc' : modale?.type === 'modifier' ? `Modifier l’examen n°${modale.examen.numero}` : `Supprimer l’examen n°${modale?.type === 'supprimer' ? modale.examen.numero : ''}`}
        description={modale?.type === 'supprimer' ? 'Cette action est définitive.' : 'Le numéro est attribué automatiquement.'}
        libelleValider={modale?.type === 'supprimer' ? 'Supprimer' : 'Enregistrer'}
        destructif={modale?.type === 'supprimer'}
        enCours={enCours}
        erreur={erreurModale}
        onFermer={() => setModale(null)}
        onValider={valider}
      >
        {modale && modale.type !== 'supprimer' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ex-date">Date de l&apos;examen</Label>
              <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-48" />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Disciplines et coefficients</legend>
              {lignes.map((l, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select value={l.matiereId} onValueChange={(v) => setLignes((p) => p.map((x, j) => (j === i ? { ...x, matiereId: v } : x)))}>
                      <SelectTrigger aria-label={`Discipline ${i + 1}`} className="h-11 w-full"><SelectValue placeholder="Discipline" /></SelectTrigger>
                      <SelectContent>
                        {matieres.map((m) => <SelectItem key={m.id} value={String(m.id)} disabled={choisies.has(String(m.id)) && l.matiereId !== String(m.id)}>{m.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    aria-label={`Coefficient ${i + 1}`} inputMode="numeric" className="h-11 w-20 text-center"
                    value={l.coefficient} onChange={(e) => setLignes((p) => p.map((x, j) => (j === i ? { ...x, coefficient: e.target.value } : x)))}
                  />
                  <Button type="button" variant="outline" className="h-11" onClick={() => setLignes((p) => p.filter((_, j) => j !== i))} aria-label={`Retirer la discipline ${i + 1}`}>Retirer</Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setLignes((p) => [...p, { matiereId: '', coefficient: '1' }])}>Ajouter une discipline</Button>
            </fieldset>
          </div>
        )}
        {modale?.type === 'supprimer' && <p>Supprimer l&apos;examen blanc n°{modale.examen.numero} du {dateFr(modale.examen.date)} ?</p>}
      </ModaleCrud>
    </div>
  );
}
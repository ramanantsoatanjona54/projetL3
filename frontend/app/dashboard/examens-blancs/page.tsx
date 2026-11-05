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
  const [nouvelle, setNouvelle] = useState('');
  const [erreurNouvelle, setErreurNouvelle] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

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
    setNouvelle(''); setErreurNouvelle(null);
    setModale({ type: 'creer' });
  }
  function ouvrirModifier(examen: ExamenListe) {
    setDate(examen.date);
    setLignes(examen.disciplines.map((d) => ({ matiereId: String(d.matiereId), coefficient: String(d.coefficient) })));
    setErreurModale(null);
    setNouvelle(''); setErreurNouvelle(null);
    setModale({ type: 'modifier', examen });
  }

  // Crée une nouvelle discipline (administrateur) puis la place dans la première ligne vide, sinon dans une nouvelle ligne
  async function creerDiscipline() {
    const nom = nouvelle.trim().replace(/\s+/g, ' ');
    if (nom.length < 2) { setErreurNouvelle('Saisissez le nom de la discipline (2 lettres au moins).'); return; }
    setCreation(true); setErreurNouvelle(null);
    try {
      const m = await api.post<MatiereExamen>('/examens-blancs/matieres', { nom });
      setMatieres((p) => [...p, m].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
      setLignes((p) => {
        const vide = p.findIndex((l) => !l.matiereId);
        return vide >= 0 ? p.map((l, j) => (j === vide ? { ...l, matiereId: String(m.id) } : l)) : [...p, { matiereId: String(m.id), coefficient: '1' }];
      });
      setNouvelle('');
    } catch (e) {
      setErreurNouvelle(messageErreur(e));
    } finally {
      setCreation(false);
    }
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
  // Une discipline déjà dans l'examen reste affichée par son nom même si elle n'est plus proposée (ex. Calcul) : on peut la retirer
  const nomsExamens = new Map(data?.examens.flatMap((e) => e.disciplines.map((d) => [String(d.matiereId), d.nom] as const)) ?? []);
  const options = [
    ...matieres.map((m) => ({ id: String(m.id), nom: m.nom })),
    ...lignes.filter((l) => l.matiereId && !matieres.some((m) => String(m.id) === l.matiereId)).map((l) => ({ id: l.matiereId, nom: nomsExamens.get(l.matiereId) ?? 'Discipline' })),
  ];

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
        large={modale?.type !== 'supprimer'}
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
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select value={l.matiereId} onValueChange={(v) => setLignes((p) => p.map((x, j) => (j === i ? { ...x, matiereId: v } : x)))}>
                      <SelectTrigger aria-label={`Discipline ${i + 1}`} className="h-11 w-full"><SelectValue placeholder="Discipline" /></SelectTrigger>
                      <SelectContent>
                        {options.map((m) => <SelectItem key={m.id} value={m.id} disabled={choisies.has(m.id) && l.matiereId !== m.id}>{m.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    aria-label={`Coefficient ${i + 1}`} inputMode="numeric" className="h-11 w-20 shrink-0 text-center"
                    value={l.coefficient} onChange={(e) => setLignes((p) => p.map((x, j) => (j === i ? { ...x, coefficient: e.target.value } : x)))}
                  />
                  <Button type="button" variant="outline" className="h-11 w-24 shrink-0" onClick={() => setLignes((p) => p.filter((_, j) => j !== i))} aria-label={`Retirer la discipline ${i + 1}`}>Retirer</Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="h-11" onClick={() => setLignes((p) => [...p, { matiereId: '', coefficient: '1' }])}>Ajouter une discipline</Button>
            </fieldset>

            <div className="rounded-md border border-dashed border-border p-3">
              <Label htmlFor="ex-nouvelle" className="text-sm font-medium">Discipline absente de la liste ?</Label>
              <div className="mt-2 flex flex-wrap items-start gap-2">
                <Input
                  id="ex-nouvelle" value={nouvelle} maxLength={60} placeholder="Nom de la nouvelle discipline" autoComplete="off"
                  onChange={(e) => { setNouvelle(e.target.value); setErreurNouvelle(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void creerDiscipline(); } }}
                  aria-invalid={!!erreurNouvelle} aria-describedby={erreurNouvelle ? 'ex-nouvelle-err' : undefined}
                  className="h-11 min-w-56 flex-1"
                />
                <Button type="button" className="h-11 shrink-0" onClick={creerDiscipline} disabled={creation || nouvelle.trim().length < 2}>
                  {creation ? 'Création...' : 'Créer et ajouter'}
                </Button>
              </div>
              {erreurNouvelle && <p id="ex-nouvelle-err" role="alert" className="mt-2 text-sm text-destructive">{erreurNouvelle}</p>}
            </div>
          </div>
        )}
        {modale?.type === 'supprimer' && <p>Supprimer l&apos;examen blanc n°{modale.examen.numero} du {dateFr(modale.examen.date)} ?</p>}
      </ModaleCrud>
    </div>
  );
}
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { dateFr } from '@/lib/format';
import { messageErreur } from '@/lib/messages';
import type { DetailExamen, SalleExamen } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const cle = (i: number, d: number) => `${i}:${d}`;
const fmt = (n: number | null) => (n === null ? '' : String(n));

function lire(s: string): { valeur: number | null; invalide: boolean } {
  const t = s.trim().replace(',', '.');
  if (t === '') return { valeur: null, invalide: false };
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return { valeur: null, invalide: true };
  const n = Number(t);
  return n > 20 ? { valeur: null, invalide: true } : { valeur: n, invalide: false };
}

export default function PageSaisieExamen() {
  const { id } = useParams<{ id: string }>();
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);

  const [salles, setSalles] = useState<SalleExamen[]>([]);
  const [salleId, setSalleId] = useState('');
  const [d, setD] = useState<DetailExamen | null>(null);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!autorise) return;
    api.get<SalleExamen[]>('/examens-blancs/salles')
      .then((s) => { setSalles(s); if (s.length >= 1) setSalleId(String(s[0].id)); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [autorise]);

  const charger = useCallback(() => {
    if (!salleId) return;
    api.get<DetailExamen>(`/examens-blancs/${id}?salleId=${salleId}`)
      .then((r) => {
        const s: Record<string, string> = {};
        r.eleves.forEach((e) => r.examen.disciplines.forEach((di) => { s[cle(e.inscriptionId, di.id)] = fmt(e.notes[di.id] ?? null); }));
        setD(r); setSaisie(s); setInitial(s); setErreur(null);
      })
      .catch((e) => setErreur(messageErreur(e)));
  }, [id, salleId]);
  useEffect(() => { setD(null); charger(); }, [charger]);

  // Moyennes calculées en direct (même formule que le serveur, qui reste la référence)
  const calcul = useMemo(() => {
    if (!d) return { moyennes: new Map<number, { m: number | null; n: number }>(), invalides: 0, modifs: 0 };
    let invalides = 0, modifs = 0;
    const moyennes = new Map<number, { m: number | null; n: number }>();
    for (const e of d.eleves) {
      let somme = 0, coefs = 0, n = 0;
      for (const di of d.examen.disciplines) {
        const c = cle(e.inscriptionId, di.id);
        const v = lire(saisie[c] ?? '');
        if (v.invalide) invalides++;
        if (v.valeur !== null) { somme += v.valeur * di.coefficient; coefs += di.coefficient; n++; }
        if (v.valeur !== lire(initial[c] ?? '').valeur && !v.invalide) modifs++;
      }
      moyennes.set(e.inscriptionId, { m: coefs ? Math.round((somme / coefs) * 100) / 100 : null, n });
    }
    return { moyennes, invalides, modifs };
  }, [d, saisie, initial]);

  async function enregistrer() {
    if (!d || enCours || calcul.invalides > 0) return;
    const notes: { inscriptionId: number; disciplineId: number; note: number | null }[] = [];
    for (const e of d.eleves) for (const di of d.examen.disciplines) {
      const c = cle(e.inscriptionId, di.id);
      const v = lire(saisie[c] ?? '');
      if (v.valeur !== lire(initial[c] ?? '').valeur) notes.push({ inscriptionId: e.inscriptionId, disciplineId: di.id, note: v.valeur });
    }
    if (notes.length === 0) return;
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      const r = await api.post<{ creees: number; modifiees: number; retirees: number }>(`/examens-blancs/${id}/notes`, { salleId: Number(salleId), notes });
      setInfo(`Notes enregistrées : ${r.creees} ajoutée(s), ${r.modifiees} modifiée(s), ${r.retirees} retirée(s).`);
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe pédagogique.</AlertDescription></Alert>;
  }
  const peutSaisir = !!d?.peutSaisir;

  return (
    <div>
      <Link href="/dashboard/examens-blancs" className="text-sm underline underline-offset-4">← Retour aux examens</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">{d ? `Examen blanc n°${d.examen.numero}` : 'Examen blanc'}</h1>
      {d && <p className="mb-4 text-sm text-muted-foreground">{dateFr(d.examen.date)} · salle {d.salle.nom} · notes sur 20, sans classement</p>}

      {salles.length > 1 && (
        <div className="mb-4 w-48 space-y-1.5">
          <Label htmlFor="ex-salle" className="text-base">Salle</Label>
          <Select value={salleId} onValueChange={setSalleId}>
            <SelectTrigger id="ex-salle" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>{salles.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {salles.length === 0 && !erreur && <Alert role="status" className="mb-4"><AlertDescription>Aucune salle de 7e ne vous est affectée.</AlertDescription></Alert>}
      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
      {d && role === 'ENSEIGNANT' && !d.peutSaisir && (
        <Alert role="status" className="mb-4"><AlertDescription>La saisie ouvre à la date de l&apos;examen ({dateFr(d.examen.date)}).</AlertDescription></Alert>
      )}

      {d && (d.eleves.length === 0 ? (
        <Alert role="status"><AlertDescription>Aucun élève validé de 7e dans cette salle.</AlertDescription></Alert>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-44 bg-card">Élève</TableHead>
                  {d.examen.disciplines.map((di) => (
                    <TableHead key={di.id} className="min-w-24 text-center">
                      {di.nom}<span className="block text-xs font-normal text-muted-foreground">coef. {di.coefficient}</span>
                    </TableHead>
                  ))}
                  <TableHead className="min-w-28 text-center">Moyenne /20</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.eleves.map((e) => {
                  const m = calcul.moyennes.get(e.inscriptionId);
                  return (
                    <TableRow key={e.inscriptionId}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{e.prenom} {e.nom}</TableCell>
                      {d.examen.disciplines.map((di) => {
                        const c = cle(e.inscriptionId, di.id);
                        const invalide = lire(saisie[c] ?? '').invalide;
                        return (
                          <TableCell key={di.id} className="text-center">
                            {peutSaisir ? (
                              <input
                                value={saisie[c] ?? ''} inputMode="decimal" autoComplete="off"
                                onChange={(ev) => { setInfo(null); setSaisie((p) => ({ ...p, [c]: ev.target.value })); }}
                                aria-label={`${e.prenom} ${e.nom}, ${di.nom}, note sur 20`} aria-invalid={invalide}
                                className={`h-11 w-20 rounded-md border bg-background px-2 text-center tabular-nums ${invalide ? 'border-destructive' : 'border-border'}`}
                              />
                            ) : <span className="tabular-nums">{saisie[c] || '—'}</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-semibold tabular-nums">
                        {m?.m ?? '—'}
                        {m && m.m !== null && m.n < d.examen.disciplines.length && (
                          <span className="block text-xs font-normal text-muted-foreground">{m.n}/{d.examen.disciplines.length} notes</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-muted font-medium">Moyenne de la classe</TableCell>
                  {d.examen.disciplines.map((di) => <TableCell key={di.id} className="bg-muted text-center tabular-nums">{d.moyennesDisciplines[di.id] ?? '—'}</TableCell>)}
                  <TableCell className="bg-muted text-center font-semibold tabular-nums">{d.moyenneClasse ?? '—'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {peutSaisir && (
            <div className="sticky bottom-0 mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-3">
              <p className="text-sm" aria-live="polite">
                {calcul.invalides > 0 ? `${calcul.invalides} note(s) invalide(s) : saisissez un nombre de 0 à 20` : calcul.modifs > 0 ? `${calcul.modifs} modification(s) non enregistrée(s)` : 'Tout est enregistré'}
              </p>
              <Button size="lg" onClick={enregistrer} disabled={enCours || calcul.modifs === 0 || calcul.invalides > 0}>{enCours ? 'Enregistrement...' : 'Enregistrer'}</Button>
            </div>
          )}
        </>
      ))}
    </div>
  );
}
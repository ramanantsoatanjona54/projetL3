'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EleveRegistre {
  inscriptionId: number; rang: number; numeroInscription: string | null;
  nom: string; prenom: string; sexe: string; niveau: string;
  absences: { date: string; justifiee: boolean }[]; retards: string[];
  totalAbsences: number; totalRetards: number;
}
interface JourTotaux { date: string; absents: number | null; presents: number | null; retards: number | null }
interface Registre {
  salle: { id: number; nom: string }; mois: string; jours: string[]; parJour: JourTotaux[];
  eleves: EleveRegistre[]; effectif: number;
  enseignant: { nom: string; prenom: string } | null; anneeScolaire: string;
}

const LETTRES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const numeroJour = (iso: string) => String(Number(iso.slice(8, 10)));
const lettreJour = (iso: string) => LETTRES[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const libelleMois = (m: string) => {
  const t = new Date(`${m}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function Contenu() {
  const { utilisateur } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const salleId = params.get('salleId') ?? '';
  const mois = params.get('mois') ?? '';
  // Jours masqués (jours fériés, vacances…) : gardés dans l'adresse pour survivre à un rechargement
  const masques = new Set((params.get('masques') ?? '').split(',').filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)));
  const [d, setD] = useState<Registre | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'SECRETARIAT', 'DIRECTRICE'].includes(role);

  useEffect(() => {
    if (!autorise || !salleId || !mois) return;
    setD(null); setErreur(null);
    api.get<Registre>(`/absences/resume-mensuel?salleId=${salleId}&mois=${mois}`)
      .then(setD)
      .catch((e) => setErreur(messageErreur(e)));
  }, [autorise, salleId, mois]);

  // Le nom proposé par « Enregistrer en PDF » : Registre-absences-<salle>-<mois>
  useEffect(() => {
    if (!d) return;
    const avant = document.title;
    document.title = `Registre-absences-${d.salle.nom}-${d.mois}`.replace(/[^\w-]+/g, '_');
    return () => { document.title = avant; };
  }, [d]);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée au personnel de l&apos;école.</AlertDescription></Alert>;
  }

  function aller(m: string, masq: Set<string>) {
    const p = new URLSearchParams({ salleId, mois: m });
    if (masq.size > 0) p.set('masques', [...masq].sort().join(','));
    router.replace(`/dashboard/absences/resume?${p.toString()}`);
  }
  function basculerJour(j: string) {
    const suivant = new Set(masques);
    if (suivant.has(j)) suivant.delete(j); else suivant.add(j);
    aller(mois, suivant);
  }

  // Seuls les jours non masqués sont imprimés ; les totaux par élève restent ceux du mois entier
  const jours = d ? d.jours.filter((j) => !masques.has(j)) : [];
  const parJour = d ? d.parJour.filter((p) => !masques.has(p.date)) : [];

  const marque = (e: EleveRegistre, jour: string) => {
    const a = e.absences.find((x) => x.date === jour);
    if (a) return a.justifiee ? 'J' : 'A';
    return e.retards.includes(jour) ? 'R' : '';
  };

  return (
    <div>
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          .registre { box-shadow: none !important; border: 0 !important; padding: 0 !important; width: auto !important; margin: 0 !important; }
          .registre thead { display: table-header-group; }
          .registre tr { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4">
        <Link href="/dashboard/absences" className="text-sm underline underline-offset-4">← Retour aux absences</Link>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <h1 className="mr-auto text-3xl font-semibold">Résumé du mois</h1>
          <div className="space-y-1.5">
            <Label htmlFor="resume-mois" className="text-base">Mois</Label>
            <Input
              id="resume-mois" type="month" value={mois} className="h-11 text-base"
              onChange={(e) => e.target.value && aller(e.target.value, new Set())}
            />
          </div>
          <Button size="lg" onClick={() => window.print()} disabled={!d}>Imprimer / Enregistrer en PDF</Button>
          <Link href="/dashboard/absences" className={buttonVariants({ variant: 'outline', size: 'lg' })}>Fermer</Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Dans la fenêtre d&apos;impression, choisissez « Enregistrer au format PDF », orientation paysage, et désactivez les en-têtes et pieds de page.
        </p>
        {d && (
          <fieldset className="mt-4 rounded-lg border border-border bg-card p-3">
            <legend className="px-1 text-sm font-medium">Jours à afficher</legend>
            <p className="mb-2 text-sm text-muted-foreground">Décochez les jours sans cours (jours fériés, vacances) : ils disparaissent du registre.</p>
            <div className="flex flex-wrap items-center gap-2">
              {d.jours.map((j) => {
                const actif = !masques.has(j);
                return (
                  <label key={j} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 ${actif ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground'}`}>
                    <input type="checkbox" className="size-5 accent-primary" checked={actif} onChange={() => basculerJour(j)} />
                    <span className="tabular-nums">{lettreJour(j)} {numeroJour(j)}</span>
                    <span className="sr-only">{actif ? ' affiché' : ' masqué'}</span>
                  </label>
                );
              })}
              {masques.size > 0 && <Button type="button" variant="ghost" onClick={() => aller(mois, new Set())}>Tout afficher</Button>}
            </div>
          </fieldset>
        )}
        {erreur && <Alert variant="destructive" role="alert" className="mt-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
        {!d && !erreur && <p className="mt-4 text-muted-foreground">Chargement...</p>}
      </div>

      {d && (
        <div className="overflow-x-auto print:overflow-visible">
          <article
            className="registre mx-auto border border-border bg-white p-[8mm] text-black shadow-sm"
            style={{ width: '297mm', fontSize: '7.5pt', lineHeight: 1.2 }}
            aria-label={`Registre d'appel ${libelleMois(d.mois)} - salle ${d.salle.nom}`}
          >
            <header className="mb-1.5 flex items-end justify-between gap-4">
              <p className="font-heading text-[1.9em] font-semibold italic leading-none">
                {libelleMois(d.mois)} <span className="text-[0.5em] font-normal not-italic">· année scolaire {d.anneeScolaire}</span>
              </p>
              <p className="text-[1.5em] font-bold leading-none">
                Classe {d.salle.nom}{d.enseignant && <> <span className="uppercase">{d.enseignant.prenom} {d.enseignant.nom}</span></>}
              </p>
            </header>

            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '6mm' }} /><col style={{ width: '10mm' }} /><col /><col style={{ width: '7mm' }} /><col style={{ width: '12mm' }} />
                {jours.map((j) => <col key={j} style={{ width: '6.2mm' }} />)}
                <col style={{ width: '8mm' }} /><col style={{ width: '8mm' }} />
              </colgroup>
              <thead>
                <tr className="bg-neutral-100">
                  <th className="border border-black px-0.5 py-0.5 text-[0.9em]" title="Numéro d'ordre">N°</th>
                  <th className="border border-black px-0.5 py-0.5 text-[0.9em]" title="Numéro d'inscription">Insc.</th>
                  <th className="border border-black px-1 py-0.5 text-center text-[0.95em]">Nom et prénoms</th>
                  <th className="border border-black px-0.5 py-0.5 text-[0.9em]">Sexe</th>
                  <th className="border border-black px-0.5 py-0.5 text-[0.9em]">Classe</th>
                  {jours.map((j) => (
                    <th key={j} scope="col" className="border border-black p-0 text-center font-bold" title={j}>
                      <span className="block leading-none">{numeroJour(j)}</span>
                      <span className="block text-[0.75em] font-normal leading-none text-neutral-600">{lettreJour(j)}</span>
                    </th>
                  ))}
                  <th className="border border-black px-0.5 py-0.5 text-[0.9em]" title="Total des absences">Abs.</th>
                  <th className="border border-black px-0.5 py-0.5 text-[0.9em]" title="Total des retards">R</th>
                </tr>
              </thead>
              <tbody>
                {d.eleves.map((e, i) => {
                  const nouveauNiveau = i > 0 && d.eleves[i - 1].niveau !== e.niveau;
                  const haut = nouveauNiveau ? 'border-t-2 border-t-black' : '';
                  return (
                    <tr key={e.inscriptionId} style={{ height: '4.9mm' }}>
                      <td className={`border border-black px-0.5 text-center tabular-nums ${haut}`}>{e.rang}</td>
                      <td className={`border border-black px-0.5 text-center tabular-nums ${haut}`}>{e.numeroInscription ?? ''}</td>
                      <td className={`truncate border border-black px-1 ${haut}`}><strong className="uppercase">{e.nom}</strong> {e.prenom}</td>
                      <td className={`border border-black text-center ${haut}`}>{e.sexe}</td>
                      <td className={`border border-black text-center ${haut}`}>{e.niveau}</td>
                      {jours.map((j) => {
                        const m = marque(e, j);
                        return <td key={j} className={`border border-black p-0 text-center font-bold ${haut}`}>{m}{m && <span className="sr-only">{m === 'A' ? ' absent' : m === 'J' ? ' absence justifiée' : ' en retard'}</span>}</td>;
                      })}
                      <td className={`border border-black text-center font-semibold tabular-nums ${haut}`}>{e.totalAbsences || ''}</td>
                      <td className={`border border-black text-center font-semibold tabular-nums ${haut}`}>{e.totalRetards || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {([['Présents', 'presents'], ['Absents', 'absents'], ['Retards', 'retards']] as const).map(([titre, cle], k) => (
                  <tr key={cle} style={{ height: '4.9mm' }}>
                    <th colSpan={5} scope="row" className={`border border-black px-2 text-right font-bold ${k === 0 ? 'border-t-2 border-t-black' : ''}`}>{titre}</th>
                    {parJour.map((p) => (
                      <td key={p.date} className={`border border-black p-0 text-center font-semibold tabular-nums ${k === 0 ? 'border-t-2 border-t-black' : ''}`}>{p[cle] ?? ''}</td>
                    ))}
                    <td className={`border border-black text-center font-bold tabular-nums ${k === 0 ? 'border-t-2 border-t-black' : ''}`}>{cle === 'absents' ? d.eleves.reduce((s, e) => s + e.totalAbsences, 0) : ''}</td>
                    <td className={`border border-black text-center font-bold tabular-nums ${k === 0 ? 'border-t-2 border-t-black' : ''}`}>{cle === 'retards' ? d.eleves.reduce((s, e) => s + e.totalRetards, 0) : ''}</td>
                  </tr>
                ))}
              </tfoot>
            </table>

            <p className="mt-1.5 text-[0.9em] italic">
              A : absent · J : absence justifiée · R : retard · case vide : présent · jours d&apos;école du lundi au vendredi{masques.size > 0 ? ` (${masques.size} jour(s) masqué(s))` : ''} · {d.effectif} élève(s)
            </p>
          </article>
        </div>
      )}
    </div>
  );
}

export default function PageResumeMensuel() {
  return <Suspense fallback={<p className="text-muted-foreground">Chargement...</p>}><Contenu /></Suspense>;
}
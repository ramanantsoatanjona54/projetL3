'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { recalculerResume } from '@/lib/bulletin-types';
import type { BulletinDetail, DisciplineBulletin, NiveauBulletin } from '@/lib/bulletin-types';
import { BulletinVue } from '@/components/bulletins/BulletinVue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX = 1000;

function appliquer(disciplines: DisciplineBulletin[], elementId: number, niveau: NiveauBulletin | null): DisciplineBulletin[] {
  return disciplines.map((d) => ({
    ...d,
    rubriques: d.rubriques.map((r) => ({ ...r, lignes: r.lignes.map((l) => (l.id === elementId ? { ...l, niveau } : l)) })),
  }));
}

export default function PageBulletinEleve() {
  const { inscriptionId, semestre } = useParams<{ inscriptionId: string; semestre: string }>();
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);
  const peutRediger = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);
  const peutEvaluer = role === 'ENSEIGNANT';
  const peutPublier = role === 'ADMIN' || role === 'DIRECTRICE';

  const [b, setB] = useState<BulletinDetail | null>(null);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [saisieEnCours, setSaisieEnCours] = useState(0);
  const initialise = useRef(false);

  // reinitTexte : seulement au premier chargement ou après enregistrement de l'appréciation (jamais écraser une frappe en cours)
  const charger = useCallback((reinitTexte: boolean) => {
    api.get<BulletinDetail>(`/bulletins/${inscriptionId}?semestre=${semestre}`)
      .then((r) => {
        setB(r); setErreur(null);
        if (reinitTexte || !initialise.current) { setTexte(r.appreciation ?? ''); initialise.current = true; }
      })
      .catch((e) => setErreur(messageErreur(e)));
  }, [inscriptionId, semestre]);
  useEffect(() => { initialise.current = false; if (autorise) charger(true); }, [autorise, charger]);

  async function choisir(elementId: number, niveau: NiveauBulletin | null) {
    if (!b) return;
    const avant = b;
    const disciplines = appliquer(b.disciplines, elementId, niveau);
    setB({ ...b, disciplines, ...recalculerResume(disciplines) });
    setInfo(null); setErreur(null);
    setSaisieEnCours((n) => n + 1);
    try {
      await api.patch(`/bulletins/${inscriptionId}/evaluations`, { semestre: Number(semestre), notes: [{ elementId, niveau }] });
    } catch (e) {
      // Retour à l'état précédent de cette ligne seulement
      setB((courant) => {
        if (!courant) return avant;
        const ancien = avant.disciplines.flatMap((d) => d.rubriques.flatMap((r) => r.lignes)).find((l) => l.id === elementId)?.niveau ?? null;
        const ds = appliquer(courant.disciplines, elementId, ancien);
        return { ...courant, disciplines: ds, ...recalculerResume(ds) };
      });
      setErreur(messageErreur(e));
    } finally {
      setSaisieEnCours((n) => n - 1);
    }
  }

  async function enregistrer() {
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      await api.patch(`/bulletins/${inscriptionId}/appreciation`, { semestre: Number(semestre), appreciation: texte });
      setInfo('Appréciation enregistrée.');
      charger(true);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function publier(publie: boolean) {
    if (!publie && !window.confirm('Dépublier ce bulletin ? Les parents ne le verront plus.')) return;
    setEnCours(true); setErreur(null); setInfo(null);
    try {
      const r = await api.post<{ publie: boolean; parentsPrevenus: number }>(`/bulletins/${inscriptionId}/publication`, { semestre: Number(semestre), publie });
      setInfo(publie ? `Bulletin publié : ${r.parentsPrevenus} parent(s) prévenu(s).` : 'Bulletin dépublié.');
      charger(false);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe de l&apos;école.</AlertDescription></Alert>;
  }
  const modifie = (b?.appreciation ?? '') !== texte;
  const p = b?.progression;
  const pourcent = p && p.total > 0 ? Math.round((p.evalue / p.total) * 100) : 0;
  const publiable = !!b && p?.complet === true && !!b.appreciation;

  return (
    <div>
      <div className="no-print">
        <Link href="/dashboard/bulletins" className="text-sm underline underline-offset-4">← Retour à la classe</Link>
        <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Bulletin · semestre {semestre}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {b && (b.publie ? <Badge>Publié aux parents</Badge> : <Badge variant="secondary">Non publié</Badge>)}
            {peutPublier && b && (b.publie
              ? <Button variant="outline" onClick={() => publier(false)} disabled={enCours}>Dépublier</Button>
              : <Button onClick={() => publier(true)} disabled={enCours || !publiable}>Publier</Button>)}
            <Button variant="outline" onClick={() => window.print()} disabled={!b}>Imprimer</Button>
          </div>
        </div>

        {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
        <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

        {b && p && (
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-base" aria-live="polite"><strong>{p.evalue}</strong> / {p.total} lignes évaluées</p>
              {p.total > 0 && (p.complet ? <Badge>Complet</Badge> : <Badge variant="secondary">Incomplet</Badge>)}
            </div>
            <div className="h-2 overflow-hidden rounded bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.evalue} aria-label="Avancement des évaluations">
              <div className="h-full bg-primary" style={{ width: `${pourcent}%` }} />
            </div>
            {p.total === 0 && <p className="mt-2 text-sm text-muted-foreground">Le contenu du bulletin n&apos;est pas défini pour ce niveau. L&apos;administrateur doit le renseigner (menu « Contenu du bulletin »).</p>}
            {peutEvaluer && p.total > 0 && !b.publie && <p className="mt-2 text-sm text-muted-foreground">Choisissez A, EA, AR ou NA pour chaque ligne : l&apos;enregistrement est automatique.</p>}
            {peutEvaluer && b.publie && <p className="mt-2 text-sm text-muted-foreground">Bulletin publié : vos modifications sont visibles tout de suite par les parents.</p>}
          </div>
        )}

        {peutPublier && b && !b.publie && !publiable && p && p.total > 0 && (
          <Alert role="status" className="mb-4">
            <AlertDescription>
              {!p.complet ? `Publication impossible : il reste ${p.total - p.evalue} ligne(s) à évaluer par l'enseignant(e).` : "Publication possible une fois l'appréciation rédigée."}
            </AlertDescription>
          </Alert>
        )}

        {b && b.examens && b.examens.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-base font-semibold">Examens blancs de cet élève</h2>
            <div className="flex flex-wrap gap-2">
              {b.examens.map((x) => (
                <Link key={x.numero} href={`/dashboard/bulletins/${inscriptionId}/examen/${x.numero}`} className={buttonVariants({ variant: 'outline' })}>
                  Examen n°{x.numero}{x.complet ? '' : ' (notes incomplètes)'}
                </Link>
              ))}
            </div>
          </div>
        )}

        {peutRediger && b && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <Label htmlFor="appreciation" className="text-base">Appréciation générale</Label>
            <Textarea
              id="appreciation" value={texte} onChange={(e) => { setInfo(null); setTexte(e.target.value); }}
              maxLength={MAX} rows={5} className="mt-2 text-base" aria-describedby="appr-aide"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p id="appr-aide" className="text-sm text-muted-foreground">{texte.length} / {MAX} caractères</p>
              <Button size="lg" onClick={enregistrer} disabled={enCours || !modifie}>{enCours ? 'Enregistrement...' : 'Enregistrer'}</Button>
            </div>
          </div>
        )}
      </div>

      {b ? <BulletinVue b={b} onChoisir={peutEvaluer ? choisir : undefined} /> : !erreur && <p className="text-muted-foreground">Chargement...</p>}
    </div>
  );
}
'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Eleve, AnneeScolaire, Niveau, Salle, ApercuInscription } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ar = (v: unknown) => `${new Intl.NumberFormat('fr-FR').format(Number(v))} Ar`; // adaptez l'unité monétaire
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

export default function InscrireEleve() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [eleve, setEleve] = useState<Eleve | null>(null);
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [salles, setSalles] = useState<Salle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(false);

  const [anneeId, setAnneeId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [salleId, setSalleId] = useState('');
  const [apercu, setApercu] = useState<ApercuInscription | null>(null);
  const [montant, setMontant] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Eleve | undefined>(`/eleves/${id}`),
      api.get<AnneeScolaire[]>('/structure/annees-scolaires'),
      api.get<Niveau[]>('/structure/niveaux'),
      api.get<Salle[]>('/structure/salles'),
    ])
      .then(([e, a, n, s]) => {
        if (!e) throw new Error('introuvable');
        setEleve(e); setAnnees(a); setNiveaux(n); setSalles(s);
        const now = new Date();
        const courante = a.find((x) => new Date(x.dateDebut) <= now && now <= new Date(x.dateFin)) ?? a[0];
        if (courante) setAnneeId(String(courante.id));
      })
      .catch(() => setErreurChargement(true))
      .finally(() => setChargement(false));
  }, [id]);

  // Aperçu : rang dans la fratrie, puis tarif d'écolage correspondant
  useEffect(() => {
    setApercu(null);
    setMontant(null);
    if (!anneeId) return;
    let annule = false;
    api.get<ApercuInscription>(`/inscriptions/apercu?eleveId=${id}&anneeScolaireId=${anneeId}`)
      .then(async (a) => {
        if (annule) return;
        setApercu(a);
        const m = await api.get<string | number | undefined>(`/finances/montant-ecolage/${a.rangFratrie}`);
        if (!annule && m !== undefined && m !== null) setMontant(String(m));
      })
      .catch(() => {});
    return () => { annule = true; };
  }, [id, anneeId]);

  const sallesDispo = useMemo(
    () => salles.filter(
      (s) => s.niveaux?.some((n) => String(n.id) === niveauId) && (!s.anneeScolaireId || String(s.anneeScolaireId) === anneeId),
    ),
    [salles, niveauId, anneeId],
  );

  const dejaInscrit = eleve?.inscriptions?.find((i) => String(i.anneeScolaire?.id) === anneeId && i.statut !== 'annulee');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (enCours) return;
    setErreurGenerale(null);

    const locales: Record<string, string> = {};
    if (!anneeId) locales.annee = "Choisissez l'année scolaire.";
    if (!niveauId) locales.niveau = 'Choisissez le niveau.';
    if (niveauId && !salleId) locales.salle = 'Choisissez la salle.';
    setErreurs(locales);
    if (Object.keys(locales).length) return;
    if (dejaInscrit) return;

    setEnCours(true);
    try {
      await api.post('/inscriptions', {
        eleveId: Number(id), anneeScolaireId: Number(anneeId), niveauId: Number(niveauId), salleId: Number(salleId),
      });
      router.push(`/dashboard/eleves/${id}`);
    } catch (err) {
      setErreurGenerale(
        err instanceof ApiError ? err.message : 'Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.',
      );
      setEnCours(false);
    }
  }

  if (chargement) return <p className="text-muted-foreground">Chargement...</p>;
  if (erreurChargement || !eleve) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive"><AlertDescription>Impossible de charger les données de l&apos;inscription.</AlertDescription></Alert>
        <Button asChild variant="outline"><Link href="/dashboard/eleves">Retour à la liste</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dashboard/eleves/${id}`} className="text-sm text-muted-foreground hover:text-primary">← Retour à la fiche</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">Inscrire dans une salle</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {eleve.nom.toUpperCase()} {eleve.prenom} · {eleve.matricule}
      </p>

      {erreurGenerale && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreurGenerale}</AlertDescription></Alert>}

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader><CardTitle>Classe et salle</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="annee" className="text-base">Année scolaire *</Label>
              <Select value={anneeId} onValueChange={(v) => { setAnneeId(v); setSalleId(''); setErreurs((p) => ({ ...p, annee: '' })); }}>
                <SelectTrigger id="annee" className="h-11 w-full text-base" aria-invalid={!!erreurs.annee}><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{annees.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.libelle}</SelectItem>)}</SelectContent>
              </Select>
              {erreurs.annee && <p className="text-sm text-destructive">{erreurs.annee}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="niveau" className="text-base">Niveau *</Label>
              <Select value={niveauId} onValueChange={(v) => { setNiveauId(v); setSalleId(''); setErreurs((p) => ({ ...p, niveau: '' })); }}>
                <SelectTrigger id="niveau" className="h-11 w-full text-base" aria-invalid={!!erreurs.niveau}><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {niveaux.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.classe ? `${n.classe.nom} · ` : ''}{n.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              {erreurs.niveau && <p className="text-sm text-destructive">{erreurs.niveau}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="salle" className="text-base">Salle *</Label>
              <Select value={salleId} onValueChange={(v) => { setSalleId(v); setErreurs((p) => ({ ...p, salle: '' })); }} disabled={!niveauId}>
                <SelectTrigger id="salle" className="h-11 w-full text-base" aria-invalid={!!erreurs.salle}>
                  <SelectValue placeholder={niveauId ? 'Choisir' : "Choisissez d'abord le niveau"} />
                </SelectTrigger>
                <SelectContent>{sallesDispo.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}</SelectContent>
              </Select>
              {niveauId && sallesDispo.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune salle n&apos;accueille ce niveau pour cette année.</p>
              )}
              {erreurs.salle && <p className="text-sm text-destructive">{erreurs.salle}</p>}
            </div>
          </CardContent>
        </Card>

        {dejaInscrit && (
          <Alert role="alert">
            <AlertTitle>Déjà inscrit(e) cette année</AlertTitle>
            <AlertDescription>
              Une inscription « {dejaInscrit.statut === 'validee' ? 'validée' : 'en attente'} » existe déjà pour cette année.{' '}
              <Link href={`/dashboard/eleves/${id}`} className="font-medium underline">Voir la fiche</Link>
            </AlertDescription>
          </Alert>
        )}

        {apercu && !dejaInscrit && (
          <Card>
            <CardHeader><CardTitle>Rang dans la fratrie et écolage</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-base">
              <p>
                Cet élève sera le <strong>{ordinal(apercu.rangFratrie)} enfant</strong> de la famille inscrit cette année
                {apercu.freres.length > 0 && <> (avec {apercu.freres.map((f) => `${f.prenom} ${f.nom}`).join(', ')})</>}.
              </p>
              {montant !== null && <p>Écolage applicable : <strong>{ar(montant)}</strong></p>}
              {!apercu.aDesParents && (
                <p className="text-sm text-muted-foreground">
                  Aucun parent n&apos;est rattaché à cet élève : la remise de fratrie ne peut pas être calculée, et aucun compte parent ne sera créé à la validation.{' '}
                  <Link href={`/dashboard/eleves/${id}`} className="underline">Ajouter un parent</Link>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={enCours || !!dejaInscrit}>
            {enCours ? 'Enregistrement...' : "Créer l'inscription"}
          </Button>
          <Button asChild type="button" variant="outline" size="lg"><Link href={`/dashboard/eleves/${id}`}>Annuler</Link></Button>
        </div>
      </form>
    </div>
  );
}
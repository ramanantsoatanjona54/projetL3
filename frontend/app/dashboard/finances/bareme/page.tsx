'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext'; // adaptez le nom exact exporté
import { messageErreur } from '@/lib/messages';
import { ar, dateFr } from '@/lib/format';
import type { Frais, RemiseFratrie, ImpactBareme } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { ChampTexte } from '@/components/structure/ChampTexte';

type Cible = { type: 'frais'; f: Frais } | { type: 'remise'; r: RemiseFratrie } | null;
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

export default function Bareme() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const peutModifier = role === 'ADMIN';

  const [frais, setFrais] = useState<Frais[]>([]);
  const [remises, setRemises] = useState<RemiseFratrie[]>([]);
  const [impact, setImpact] = useState<ImpactBareme | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [cible, setCible] = useState<Cible>(null);
  const [valeur, setValeur] = useState('');
  const [erreurChamp, setErreurChamp] = useState<string | undefined>();
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [nbEnfants, setNbEnfants] = useState('3');

  const charger = useCallback(() => {
    Promise.all([
      api.get<Frais[]>('/finances/frais'),
      api.get<RemiseFratrie[]>('/finances/remises-fraternite'),
      api.get<ImpactBareme>('/finances/bareme/impact'),
    ])
      .then(([f, r, i]) => { setFrais(f); setRemises(r); setImpact(i); setErreur(null); setCharge(true); })
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const base = frais.find((f) => f.typeFrais?.code === 'ECOLAGE');
  const baseMontant = base ? Number(base.montant) : null;

  // Même règle que le serveur : au-delà du dernier rang défini, on applique la dernière remise
  function montantRang(rang: number): number | null {
    if (rang <= 1) return baseMontant;
    const r = remises.find((x) => x.rang === rang) ?? remises[remises.length - 1];
    return r ? Number(r.montant) : null;
  }
  const totalFamille = Array.from({ length: Number(nbEnfants) }, (_, i) => montantRang(i + 1) ?? 0)
    .reduce((s, m) => s + m, 0);

  function ouvrir(c: Cible) {
    setErreurChamp(undefined);
    setErreurServeur(null);
    setValeur(c?.type === 'frais' ? String(Number(c.f.montant)) : c?.type === 'remise' ? String(Number(c.r.montant)) : '');
    setCible(c);
  }

  function valider(): number | null {
    const v = Number(valeur);
    if (!valeur.trim() || !Number.isFinite(v) || v <= 0) { setErreurChamp('Indiquez un montant supérieur à 0.'); return null; }
    if (!Number.isInteger(v)) { setErreurChamp('Indiquez un montant entier, sans décimales.'); return null; }
    if (cible?.type === 'remise') {
      const rang = cible.r.rang;
      const prec = remises.find((x) => x.rang === rang - 1);
      const suiv = remises.find((x) => x.rang === rang + 1);
      if (baseMontant !== null && v > baseMontant) { setErreurChamp(`Une remise ne peut pas dépasser le tarif de base (${ar(baseMontant)}).`); return null; }
      if (prec && v > Number(prec.montant)) { setErreurChamp(`Le ${ordinal(rang)} enfant ne peut pas payer plus que le ${ordinal(prec.rang)} (${ar(prec.montant)}).`); return null; }
      if (suiv && v < Number(suiv.montant)) { setErreurChamp(`Le ${ordinal(rang)} enfant ne peut pas payer moins que le ${ordinal(suiv.rang)} (${ar(suiv.montant)}).`); return null; }
    } else if (cible?.type === 'frais' && cible.f.typeFrais?.code === 'ECOLAGE') {
      const plusHaute = Math.max(0, ...remises.map((r) => Number(r.montant)));
      if (v < plusHaute) { setErreurChamp(`Le tarif de base ne peut pas être inférieur à une remise existante (${ar(plusHaute)}). Modifiez d'abord les remises.`); return null; }
    }
    setErreurChamp(undefined);
    return v;
  }

  async function envoyer() {
    if (!cible) return;
    const v = valider();
    if (v === null) return;
    setEnCours(true);
    setErreurServeur(null);
    try {
      if (cible.type === 'frais') await api.patch(`/finances/frais/${cible.f.id}`, { montant: v });
      else await api.patch(`/finances/remises-fraternite/${cible.r.id}`, { montant: v });
      setCible(null);
      charger();
    } catch (e) {
      setErreurServeur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !['ADMIN', 'COMPTABLE', 'DIRECTRICE'].includes(utilisateur.role)) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administration et à la comptabilité.</AlertDescription></Alert>;
  }

  const ancien = cible?.type === 'frais' ? Number(cible.f.montant) : cible?.type === 'remise' ? Number(cible.r.montant) : 0;
  const nouveau = Number(valeur);
  const variation = Number.isFinite(nouveau) && valeur.trim() ? nouveau - ancien : 0;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Tarifs</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Écolage mensuel et remises de fratrie. {peutModifier ? 'Vous pouvez modifier les montants.' : 'Consultation seule : seul l’administrateur modifie les tarifs.'}
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!charge && !erreur && <p className="text-muted-foreground">Chargement...</p>}

      {charge && (
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Frais</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Frais</TableHead><TableHead>Montant</TableHead><TableHead>Dernière mise à jour</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {frais.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aucun tarif défini.</TableCell></TableRow>
                  ) : frais.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.typeFrais?.libelle ?? f.typeFrais?.code ?? `Frais #${f.id}`}</TableCell>
                      <TableCell>{ar(f.montant)}</TableCell>
                      <TableCell>{dateFr(f.dateMaj)}</TableCell>
                      <TableCell className="text-right">
                        {peutModifier && <Button size="sm" variant="outline" onClick={() => ouvrir({ type: 'frais', f })}>Modifier</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Remises de fratrie (écolage mensuel par rang)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead><TableHead>Montant</TableHead><TableHead>Économie / plein tarif</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remises.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aucune remise définie.</TableCell></TableRow>
                  ) : remises.map((r) => {
                    const eco = baseMontant !== null ? baseMontant - Number(r.montant) : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{ordinal(r.rang)} enfant inscrit</TableCell>
                        <TableCell>{ar(r.montant)}</TableCell>
                        <TableCell>{eco !== null && baseMontant ? `${ar(eco)} (${Math.round((eco / baseMontant) * 100)} %)` : '—'}</TableCell>
                        <TableCell className="text-right">
                          {peutModifier && <Button size="sm" variant="outline" onClick={() => ouvrir({ type: 'remise', r })}>Modifier</Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Simulateur de famille</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="nb-enfants" className="text-base">Nombre d&apos;enfants inscrits</Label>
                <Select value={nbEnfants} onValueChange={setNbEnfants}>
                  <SelectTrigger id="nb-enfants" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-base">
                Écolage mensuel de la famille : <strong>{ar(totalFamille)}</strong>
                {Number(nbEnfants) > 1 && baseMontant !== null && (
                  <span className="text-muted-foreground"> (au lieu de {ar(baseMontant * Number(nbEnfants))} sans remise)</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <ModaleCrud
        ouvert={!!cible}
        titre={cible?.type === 'remise' ? `Modifier la remise du ${ordinal(cible.r.rang)} enfant` : 'Modifier le tarif'}
        description="Le nouveau montant s'applique immédiatement."
        libelleValider="Appliquer le nouveau tarif"
        enCours={enCours} erreur={erreurServeur} onFermer={() => { if (!enCours) setCible(null); }} onValider={envoyer}
      >
        <ChampTexte id="b-montant" label="Nouveau montant (Ar) *" type="number" value={valeur} onChange={setValeur} erreur={erreurChamp} />
        <p className="text-base">
          Actuel : <strong>{ar(ancien)}</strong>
          {variation !== 0 && (
            <> · variation : <strong className={variation > 0 ? 'text-destructive' : ''}>{variation > 0 ? '+' : '−'}{ar(Math.abs(variation))}</strong></>
          )}
        </p>
        <Alert role="note">
          <AlertDescription>
            Les montants sont calculés en direct : ce changement modifie le total et le reste à payer de{' '}
            <strong>{impact?.inscriptionsValidees ?? 0} inscription(s) validée(s)</strong>
            {impact?.annee ? ` de l'année ${impact.annee}` : ''}. Les paiements déjà encaissés restent inchangés. L&apos;action est enregistrée dans le journal.
          </AlertDescription>
        </Alert>
      </ModaleCrud>
    </div>
  );
}
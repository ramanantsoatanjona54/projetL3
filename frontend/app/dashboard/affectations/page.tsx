'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { EnseignantAffectation, SalleAffectation } from '@/lib/types';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Modale = { salle: SalleAffectation; mode: 'affecter' | 'retirer' } | null;

export default function Affectations() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const peutVoir = role === 'ADMIN' || role === 'DIRECTRICE' || role === 'SECRETARIAT';
  const peutModifier = role === 'ADMIN';

  const [salles, setSalles] = useState<SalleAffectation[] | null>(null);
  const [enseignants, setEnseignants] = useState<EnseignantAffectation[]>([]);
  const [erreurPage, setErreurPage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [modale, setModale] = useState<Modale>(null);
  const [choix, setChoix] = useState('');
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        api.get<SalleAffectation[]>('/affectations/salles'),
        api.get<EnseignantAffectation[]>('/affectations/enseignants'),
      ]);
      setSalles(s); setEnseignants(e); setErreurPage(null);
    } catch (err) { setErreurPage(messageErreur(err)); }
  }, []);

  useEffect(() => { if (peutVoir) void charger(); }, [peutVoir, charger]);

  const sansSalle = useMemo(() => enseignants.filter((e) => !e.salle), [enseignants]);
  const sallesAPourvoir = (salles ?? []).filter((s) => s.enseignants.length === 0).length;

  function ouvrir(salle: SalleAffectation, mode: 'affecter' | 'retirer') {
    setModale({ salle, mode }); setChoix(''); setAvertissements([]); setErreur(null); setInfo(null);
  }

  // Conséquences d'une affectation, montrées AVANT d'envoyer (le serveur les revérifie)
  function conflits(salle: SalleAffectation, ens: EnseignantAffectation): string[] {
    const m: string[] = [];
    const autres = salle.enseignants.filter((x) => x.id !== ens.id);
    if (autres.length > 0) m.push(`La salle ${salle.nom} a déjà pour enseignant(e) ${autres.map((x) => x.nom).join(', ')} : il ou elle sera retiré(e) de cette salle.`);
    if (ens.salle && ens.salle.id !== salle.id) m.push(`${ens.nom} est déjà affecté(e) à la salle ${ens.salle.nom} : il ou elle la quittera, et cette salle n'aura plus d'enseignant.`);
    return m;
  }

  async function envoyer(personnelId: number | null, remplacer: boolean, confirmation: string) {
    if (!modale) return;
    setEnCours(true); setErreur(null);
    try {
      await api.patch(`/affectations/salles/${modale.salle.id}/enseignant`, { personnelId, remplacer });
      setModale(null); setInfo(confirmation); await charger();
    } catch (err) { setErreur(messageErreur(err)); } finally { setEnCours(false); }
  }

  async function valider() {
    if (!modale) return;
    if (modale.mode === 'retirer') { await envoyer(null, false, `Salle ${modale.salle.nom} : enseignant retiré.`); return; }
    const ens = enseignants.find((e) => String(e.id) === choix);
    if (!ens) { setErreur('Choisissez un enseignant dans la liste.'); return; }
    const c = conflits(modale.salle, ens);
    if (c.length > 0 && avertissements.length === 0) { setAvertissements(c); return; } // 1er clic : on montre les conséquences
    await envoyer(ens.id, c.length > 0, `Salle ${modale.salle.nom} : ${ens.nom} est affecté(e).`);
  }

  if (utilisateur && !peutVoir) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cet écran est réservé à l&apos;administration, à la direction et au secrétariat.</AlertDescription></Alert>;
  }
  if (erreurPage) return <Alert variant="destructive" role="alert"><AlertDescription>{erreurPage}</AlertDescription></Alert>;
  if (!salles) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Affectation des enseignants</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {salles.length} salle(s) · {sallesAPourvoir === 0 ? 'toutes ont un enseignant' : `${sallesAPourvoir} sans enseignant`} · {sansSalle.length} enseignant(s) sans salle
      </p>
      {info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {salles.map((s) => (
            <section key={s.id} aria-labelledby={`salle-${s.id}`} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 id={`salle-${s.id}`} className="text-xl font-semibold">Salle {s.nom}</h2>
                  <p className="text-sm text-muted-foreground">{s.inscrits} inscrit(s){s.anneeScolaire ? ` · ${s.anneeScolaire.libelle}` : ''}</p>
                </div>
                {s.enseignants.length === 0 && <Badge variant="outline" className="text-destructive">Sans enseignant</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.niveaux.map((n) => <Badge key={n.id} variant="secondary">{n.nom}</Badge>)}
              </div>
              <div className="mt-3">
                {s.enseignants.length === 0 ? (
                  <p className="text-muted-foreground">Aucun enseignant affecté.</p>
                ) : s.enseignants.map((e) => (
                  <p key={e.id} className="text-base font-medium">
                    {e.nom}
                    {!e.compteEnseignant && <span className="block text-sm font-normal text-destructive">Pas de compte enseignant actif : cette personne ne pourra pas se connecter.</span>}
                  </p>
                ))}
              </div>
              {peutModifier && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => ouvrir(s, 'affecter')}>{s.enseignants.length > 0 ? 'Changer' : 'Affecter'}</Button>
                  {s.enseignants.length > 0 && <Button size="sm" variant="outline" onClick={() => ouvrir(s, 'retirer')}>Retirer</Button>}
                </div>
              )}
            </section>
          ))}
        </div>

        <aside aria-labelledby="sans-salle" className="h-fit rounded-lg border border-border bg-card p-4">
          <h2 id="sans-salle" className="mb-2 text-xl font-semibold">Enseignants sans salle</h2>
          {sansSalle.length === 0 ? (
            <p className="text-muted-foreground">Tous les enseignants ont une salle.</p>
          ) : (
            <ul className="space-y-2">
              {sansSalle.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.nom}</span>
                  <span className="block text-sm text-muted-foreground">{e.matricule}{!e.compteEnseignant && ' · pas de compte actif'}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <ModaleCrud
        ouvert={!!modale}
        titre={modale?.mode === 'retirer' ? "Retirer l'enseignant" : `Affecter un enseignant à la salle ${modale?.salle.nom ?? ''}`}
        description={modale?.mode === 'retirer'
          ? `La salle ${modale.salle.nom} n'aura plus d'enseignant. Les notes déjà saisies sont conservées.`
          : "Un enseignant n'a qu'une salle, et une salle n'a qu'un enseignant."}
        libelleValider={modale?.mode === 'retirer' ? 'Retirer' : avertissements.length > 0 ? 'Confirmer le remplacement' : 'Affecter'}
        destructif={modale?.mode === 'retirer' || avertissements.length > 0}
        enCours={enCours} erreur={erreur} onFermer={fermer} onValider={valider}
      >
        {modale?.mode === 'retirer' ? (
          <p className="text-base">Retirer <strong>{modale.salle.enseignants.map((e) => e.nom).join(', ')}</strong> de la salle {modale.salle.nom} ?</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ens" className="text-base">Enseignant</Label>
              <Select value={choix} onValueChange={(v) => { setChoix(v); setAvertissements([]); setErreur(null); }}>
                <SelectTrigger id="ens" className="h-11 w-full text-base"><SelectValue placeholder="Choisir un enseignant" /></SelectTrigger>
                <SelectContent>
                  {enseignants.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nom} ({e.matricule}){e.salle ? ` · actuellement en ${e.salle.nom}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {avertissements.length > 0 && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  <ul className="list-disc pl-5">{avertissements.map((a) => <li key={a}>{a}</li>)}</ul>
                  <p className="mt-2">Cliquez sur « Confirmer le remplacement » pour continuer.</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </ModaleCrud>
    </div>
  );

  function fermer() { if (!enCours) setModale(null); }
}
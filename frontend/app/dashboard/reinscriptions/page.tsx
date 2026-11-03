'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { dateFr } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModaleCrud } from '@/components/structure/ModaleCrud';

type Annee = { id: number; libelle: string; dateDebut: string; dateFin: string };
type Candidat = {
  eleveId: number; nom: string; prenom: string; matricule: string;
  niveauActuelId: number; niveauActuel: string; salleActuelle: string; niveauSuggereId: number | null;
};
type Donnees = {
  annees: Annee[]; cible: Annee | null; source: Annee | null;
  niveaux: { id: number; nom: string; classe: string }[];
  salles: { id: number; nom: string; niveauIds: number[] }[];
  nbSallesAnnee: number; candidats: Candidat[];
};
type Choix = { coche: boolean; niveauId: string; salleId: string };
type Resultat = { resultats: { eleveId: number; ok: boolean; message?: string }[] };

function Contenu() {
  const [d, setD] = useState<Donnees | null>(null);
  const [choix, setChoix] = useState<Record<number, Choix>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [echecs, setEchecs] = useState<string[]>([]);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurModale, setErreurModale] = useState<string | null>(null);

  const charger = useCallback((id: number | null) => {
    api.get<Donnees>(`/inscriptions/reinscription${id ? `?anneeCibleId=${id}` : ''}`)
      .then((r) => {
        setD(r);
        const init: Record<number, Choix> = {};
        for (const c of r.candidats) {
          // Dernier niveau de l'école : on propose le maintien dans le même niveau (redoublement)
          const niveauId = c.niveauSuggereId ?? c.niveauActuelId;
          const possibles = r.salles.filter((s) => s.niveauIds.includes(niveauId));
          init[c.eleveId] = {
            coche: false,
            niveauId: String(niveauId),
            salleId: possibles.length === 1 ? String(possibles[0].id) : '',
          };
        }
        setChoix(init);
        setErreur(null);
      })
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  useEffect(() => { charger(null); }, [charger]);

  const sallesPour = (niveauId: string) => d?.salles.filter((s) => s.niveauIds.includes(Number(niveauId))) ?? [];
  const maj = (id: number, p: Partial<Choix>) => setChoix((c) => ({ ...c, [id]: { ...c[id], ...p } }));

  const pretes = useMemo(
    () => (d?.candidats ?? []).filter((c) => {
      const x = choix[c.eleveId];
      return x?.coche && x.niveauId && x.salleId;
    }),
    [d, choix],
  );
  const cochesSansSalle = (d?.candidats ?? []).filter((c) => {
    const x = choix[c.eleveId];
    return x?.coche && !(x.niveauId && x.salleId);
  }).length;

  function toutCocher(valeur: boolean) {
    setChoix((c) => {
      const n: Record<number, Choix> = {};
      for (const [id, x] of Object.entries(c)) n[Number(id)] = { ...x, coche: valeur && !!x.salleId };
      return n;
    });
  }

  async function ouvrirSalles() {
    if (!d?.cible) return;
    setErreur(null); setInfo(null);
    try {
      const r = await api.post<{ creees: number }>('/inscriptions/reinscription/ouvrir-salles', { anneeScolaireId: d.cible.id });
      setInfo(`${r.creees} salle(s) ouverte(s) pour ${d.cible.libelle}.`);
      charger(d.cible.id);
    } catch (e) { setErreur(messageErreur(e)); }
  }

  async function valider() {
    if (!d?.cible) return;
    setEnCours(true); setErreurModale(null);
    try {
      const r = await api.post<Resultat>('/inscriptions/reinscription', {
        anneeScolaireId: d.cible.id,
        lignes: pretes.map((c) => ({
          eleveId: c.eleveId,
          niveauId: Number(choix[c.eleveId].niveauId),
          salleId: Number(choix[c.eleveId].salleId),
        })),
      });
      const ok = r.resultats.filter((x) => x.ok).length;
      const noms = new Map(d.candidats.map((c) => [c.eleveId, `${c.nom.toUpperCase()} ${c.prenom}`]));
      setEchecs(r.resultats.filter((x) => !x.ok).map((x) => `${noms.get(x.eleveId)} : ${x.message}`));
      setInfo(`${ok} ré-inscription(s) créée(s), en attente de validation par le Secrétariat.`);
      setConfirmer(false);
      charger(d.cible.id);
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Ré-inscriptions</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Inscrivez les élèves de l&apos;année précédente dans l&apos;année à venir. Les inscriptions créées sont « en attente » :
        le Secrétariat les valide ensuite, comme d&apos;habitude.
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>
      {echecs.length > 0 && (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription>
            <p className="font-medium">{echecs.length} élève(s) non ré-inscrit(s) :</p>
            <ul className="list-disc pl-5">{echecs.map((m) => <li key={m}>{m}</li>)}</ul>
          </AlertDescription>
        </Alert>
      )}

      {!d ? <p className="text-muted-foreground">Chargement...</p> : !d.cible ? (
        <Alert>
          <AlertDescription>
            Aucune année en cours ou à venir. Créez d&apos;abord la nouvelle année scolaire dans l&apos;administration.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div className="w-64 space-y-1.5">
              <Label htmlFor="re-annee" className="text-base">Inscrire dans l&apos;année</Label>
              <Select
                value={String(d.cible.id)}
                onValueChange={(v) => { setEchecs([]); setInfo(null); charger(Number(v)); }}
              >
                <SelectTrigger id="re-annee" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {d.annees.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="pb-2 text-sm text-muted-foreground">
              Du {dateFr(d.cible.dateDebut)} au {dateFr(d.cible.dateFin)}
              {d.source ? ` · élèves venant de ${d.source.libelle}` : ' · aucune année précédente'}
            </p>
          </div>

          {d.salles.length === 0 && (
            <Alert className="mb-4">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>Aucune salle n&apos;est disponible pour {d.cible.libelle}.</span>
                {d.source && <Button onClick={ouvrirSalles}>Ouvrir les salles de {d.source.libelle}</Button>}
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {d.candidats.length} élève(s) à ré-inscrire · {pretes.length} prêt(s)
              {cochesSansSalle > 0 && ` · ${cochesSansSalle} coché(s) sans salle`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toutCocher(true)}>Tout cocher (avec salle)</Button>
              <Button variant="outline" size="sm" onClick={() => toutCocher(false)}>Tout décocher</Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><span className="sr-only">Sélection</span></TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Année précédente</TableHead>
                  <TableHead>Niveau à venir</TableHead>
                  <TableHead>Salle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.candidats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {d.source
                        ? `Aucun élève à ré-inscrire : tous les élèves validés de ${d.source.libelle} sont déjà inscrits pour ${d.cible.libelle}.`
                        : 'Aucune année précédente : rien à ré-inscrire.'}
                    </TableCell>
                  </TableRow>
                ) : d.candidats.map((c) => {
                  const x = choix[c.eleveId];
                  if (!x) return null;
                  const salles = sallesPour(x.niveauId);
                  const nomEleve = `${c.nom.toUpperCase()} ${c.prenom}`;
                  return (
                    <TableRow key={c.eleveId}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#A64E5E]"
                          checked={x.coche}
                          disabled={!x.salleId}
                          onChange={(e) => maj(c.eleveId, { coche: e.target.checked })}
                          aria-label={`Sélectionner ${nomEleve}`}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{nomEleve}</span>
                        <span className="block text-sm text-muted-foreground">{c.matricule}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.niveauActuel} · salle {c.salleActuelle}
                        {c.niveauSuggereId === null && <Badge variant="outline" className="ml-2">Dernier niveau</Badge>}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={x.niveauId}
                          onValueChange={(v) => {
                            const poss = d.salles.filter((s) => s.niveauIds.includes(Number(v)));
                            maj(c.eleveId, { niveauId: v, salleId: poss.length === 1 ? String(poss[0].id) : '', coche: false });
                          }}
                        >
                          <SelectTrigger className="h-10 w-40" aria-label={`Niveau à venir de ${nomEleve}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {d.niveaux.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.nom}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {salles.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Aucune salle pour ce niveau</span>
                        ) : (
                          <Select value={x.salleId} onValueChange={(v) => maj(c.eleveId, { salleId: v })}>
                            <SelectTrigger className="h-10 w-32" aria-label={`Salle de ${nomEleve}`}>
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
                            <SelectContent>
                              {salles.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end">
            <Button size="lg" disabled={pretes.length === 0} onClick={() => { setErreurModale(null); setConfirmer(true); }}>
              Ré-inscrire {pretes.length > 0 ? `${pretes.length} élève(s)` : ''}
            </Button>
          </div>
        </>
      )}

      <ModaleCrud
        ouvert={confirmer}
        titre="Confirmer les ré-inscriptions"
        description={d?.cible ? `Année ${d.cible.libelle}` : ''}
        libelleValider="Ré-inscrire"
        enCours={enCours}
        erreur={erreurModale}
        onFermer={() => { if (!enCours) setConfirmer(false); }}
        onValider={valider}
      >
        <p className="text-sm text-muted-foreground">
          {pretes.length} élève(s) seront inscrits en attente de validation. Le rang de fratrie est recalculé pour la nouvelle année.
          Un élève déjà inscrit cette année, ou une année terminée, sera refusé avec un message précis.
        </p>
      </ModaleCrud>
    </div>
  );
}

export default function PageReinscriptions() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  if (!utilisateur) return null;
  if (role !== 'SECRETARIAT' && role !== 'ADMIN') {
    return <Alert variant="destructive"><AlertDescription>Accès réservé au Secrétariat et à l&apos;administrateur.</AlertDescription></Alert>;
  }
  return <Contenu />;
}
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { ArbreProgramme, CompetenceProg, LeconProg, MatiereProgramme, NiveauProgramme } from '@/lib/types';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Genre = 'domaines' | 'sous-domaines' | 'competences' | 'rubriques' | 'lecons';
type Parent = { ceintureId?: number; domaineId?: number; sousDomaineId?: number; matiereId?: number; rubriqueId?: number };
type Modale =
  | { action: 'creer'; genre: Genre; parent: Parent }
  | { action: 'modifier'; genre: Genre; id: number; texte: string; ordre?: number; evalue: number }
  | { action: 'supprimer'; genre: Genre; id: number; texte: string };

const TEXTES: Record<Genre, { nouveau: string; modifier: string; supprimer: string; champ: string; long?: boolean }> = {
  domaines: { nouveau: 'Nouveau domaine', modifier: 'Renommer le domaine', supprimer: 'Supprimer le domaine', champ: 'Nom du domaine' },
  'sous-domaines': { nouveau: 'Nouveau sous-domaine', modifier: 'Renommer le sous-domaine', supprimer: 'Supprimer le sous-domaine', champ: 'Nom du sous-domaine' },
  competences: { nouveau: 'Nouvelle compétence', modifier: 'Modifier la compétence', supprimer: 'Supprimer la compétence', champ: 'Libellé de la compétence', long: true },
  rubriques: { nouveau: 'Nouvelle rubrique', modifier: 'Renommer la rubrique', supprimer: 'Supprimer la rubrique', champ: 'Nom de la rubrique' },
  lecons: { nouveau: 'Nouvelle leçon', modifier: 'Modifier la leçon', supprimer: 'Supprimer la leçon', champ: 'Titre de la leçon' },
};

// Regroupe les leçons d'une ceinture : matière puis rubrique (le serveur les renvoie déjà triées)
function grouper(lecons: LeconProg[]) {
  const matieres = new Map<number, { nom: string; rubriques: Map<number, { nom: string; rubriqueId: number | null; lecons: LeconProg[] }> }>();
  for (const l of lecons) {
    const m = matieres.get(l.matiere.id) ?? { nom: l.matiere.nom, rubriques: new Map() };
    const rid = l.rubrique?.id ?? 0;
    const r = m.rubriques.get(rid) ?? { nom: l.rubrique?.nom ?? 'Sans rubrique', rubriqueId: l.rubrique?.id ?? null, lecons: [] };
    r.lecons.push(l);
    m.rubriques.set(rid, r);
    matieres.set(l.matiere.id, m);
  }
  return [...matieres.entries()];
}

function LigneCompetence({ c, onModifier, onSupprimer }: { c: CompetenceProg; onModifier: () => void; onSupprimer: () => void }) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <span className="min-w-0 flex-1">
        {c.libelle}
        {c._count.notes > 0 && <Badge variant="secondary" className="ml-2">Évaluée · {c._count.notes}</Badge>}
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-1">
        <Button size="sm" variant="outline" aria-label={`Modifier la compétence : ${c.libelle}`} onClick={onModifier}>Modifier</Button>
        {c._count.notes === 0 && <Button size="sm" variant="ghost" aria-label={`Supprimer la compétence : ${c.libelle}`} onClick={onSupprimer}>Supprimer</Button>}
      </span>
    </li>
  );
}

export default function Programme() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const autorise = role === 'ADMIN' || role === 'DIRECTRICE';

  const [niveaux, setNiveaux] = useState<NiveauProgramme[]>([]);
  const [matieres, setMatieres] = useState<MatiereProgramme[]>([]);
  const [niveauId, setNiveauId] = useState('');
  const [semestre, setSemestre] = useState(1);
  const [arbre, setArbre] = useState<ArbreProgramme | null>(null);
  const [erreurPage, setErreurPage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [modale, setModale] = useState<Modale | null>(null);
  const [texte, setTexte] = useState('');
  const [ordre, setOrdre] = useState('');
  const [matiereId, setMatiereId] = useState('');
  const [rubriqueId, setRubriqueId] = useState('aucune');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const chargerMatieres = useCallback(async () => {
    setMatieres(await api.get<MatiereProgramme[]>('/programmes/matieres'));
  }, []);

  const chargerArbre = useCallback(async (id: string) => {
    if (!id) return;
    try { setArbre(await api.get<ArbreProgramme>(`/programmes/niveaux/${id}/arbre`)); setErreurPage(null); }
    catch (e) { setErreurPage(messageErreur(e)); }
  }, []);

  useEffect(() => {
    if (!autorise) return;
    Promise.all([api.get<NiveauProgramme[]>('/programmes/niveaux'), api.get<MatiereProgramme[]>('/programmes/matieres')])
      .then(([n, m]) => { setNiveaux(n); setMatieres(m); if (n.length > 0) setNiveauId(String(n[0].id)); })
      .catch((e) => setErreurPage(messageErreur(e)));
  }, [autorise]);

  useEffect(() => { void chargerArbre(niveauId); }, [niveauId, chargerArbre]);

  const semestreActif = arbre?.semestres.find((s) => s.numero === semestre) ?? arbre?.semestres[0];

  function ouvrir(m: Modale) {
    setModale(m); setErreur(null); setInfo(null);
    setTexte(m.action === 'creer' ? '' : m.texte);
    setOrdre(m.action === 'modifier' && m.ordre !== undefined ? String(m.ordre) : '');
    setMatiereId(m.action === 'creer' && m.parent.matiereId ? String(m.parent.matiereId) : '');
    setRubriqueId(m.action === 'creer' && m.parent.rubriqueId ? String(m.parent.rubriqueId) : 'aucune');
  }

  async function valider() {
    if (!modale || !arbre) return;
    const t = texte.trim();
    if (modale.action !== 'supprimer' && !t) { setErreur('Ce champ est obligatoire.'); return; }
    if (modale.action === 'creer' && (modale.genre === 'lecons' || modale.genre === 'rubriques') && !matiereId) {
      setErreur('Choisissez une matière.'); return;
    }
    const ordreNum = ordre.trim() === '' ? undefined : Number(ordre);
    if (ordreNum !== undefined && (!Number.isInteger(ordreNum) || ordreNum < 0 || ordreNum > 9999)) {
      setErreur("L'ordre doit être un nombre entier entre 0 et 9999."); return;
    }

    setEnCours(true); setErreur(null);
    try {
      const g = modale.genre;
      if (modale.action === 'supprimer') {
        await api.delete(`/programmes/${g}/${modale.id}`);
      } else if (modale.action === 'modifier') {
        const corps = g === 'competences' ? { libelle: t } : g === 'lecons' ? { titre: t, ordre: ordreNum } : { nom: t };
        await api.patch(`/programmes/${g}/${modale.id}`, corps);
      } else {
        const p = modale.parent;
        let corps: Record<string, unknown>;
        if (g === 'domaines') corps = { ceintureId: p.ceintureId, nom: t };
        else if (g === 'sous-domaines') corps = { domaineId: p.domaineId, nom: t };
        else if (g === 'competences') corps = { domaineId: p.domaineId, sousDomaineId: p.sousDomaineId, libelle: t };
        else if (g === 'rubriques') corps = { matiereId: Number(matiereId), nom: t };
        else corps = {
          niveauId: arbre.niveau.id, ceintureId: p.ceintureId, matiereId: Number(matiereId),
          rubriqueId: rubriqueId !== 'aucune' ? Number(rubriqueId) : undefined, titre: t, ordre: ordreNum,
        };
        await api.post(`/programmes/${g}`, corps);
      }
      setModale(null);
      setInfo(modale.action === 'creer' ? 'Ajout enregistré.' : modale.action === 'modifier' ? 'Modification enregistrée.' : 'Suppression effectuée.');
      await Promise.all([chargerArbre(niveauId), chargerMatieres()]);
    } catch (e) { setErreur(messageErreur(e)); } finally { setEnCours(false); }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cet écran est réservé à l&apos;administration et à la direction.</AlertDescription></Alert>;
  }
  if (erreurPage) return <Alert variant="destructive" role="alert"><AlertDescription>{erreurPage}</AlertDescription></Alert>;
  if (!arbre) return <p className="text-muted-foreground">Chargement...</p>;

  const mAff = modale;
  const textes = mAff ? TEXTES[mAff.genre] : null;
  const rubriquesDeLaMatiere = matieres.find((m) => String(m.id) === matiereId)?.rubriques ?? [];

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Programme pédagogique</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Compétences et leçons évaluées par les enseignants. Un élément déjà évalué ne peut pas être supprimé : seul son texte se corrige.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="w-60 space-y-1.5">
          <Label htmlFor="niveau" className="text-base">Niveau</Label>
          <Select value={niveauId} onValueChange={(v) => { setNiveauId(v); setArbre(null); setInfo(null); }}>
            <SelectTrigger id="niveau" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              {niveaux.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.classe.nom} · {n.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div role="group" aria-label="Semestre" className="flex gap-2">
          {arbre.semestres.map((s) => (
            <Button key={s.id} variant={s.numero === semestreActif?.numero ? 'default' : 'outline'} aria-pressed={s.numero === semestreActif?.numero} onClick={() => setSemestre(s.numero)} className="h-11">
              Semestre {s.numero}
            </Button>
          ))}
        </div>
      </div>

      {info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}

      {!semestreActif || semestreActif.ceintures.length === 0 ? (
        <Alert role="status"><AlertDescription>Aucune ceinture n&apos;est définie pour ce niveau et ce semestre.</AlertDescription></Alert>
      ) : semestreActif.ceintures.map((ceinture) => (
        <section key={ceinture.id} aria-labelledby={`ceinture-${ceinture.id}`} className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <h2 id={`ceinture-${ceinture.id}`} className="text-2xl font-semibold">Ceinture {ceinture.nom}</h2>
            {arbre.type === 'domaines' ? (
              <Button onClick={() => ouvrir({ action: 'creer', genre: 'domaines', parent: { ceintureId: ceinture.id } })}>Ajouter un domaine</Button>
            ) : (
              <Button onClick={() => ouvrir({ action: 'creer', genre: 'lecons', parent: { ceintureId: ceinture.id } })}>Ajouter une leçon</Button>
            )}
          </div>

          {arbre.type === 'domaines' ? (
            ceinture.domaines.length === 0 ? (
              <p className="text-muted-foreground">Aucun domaine pour cette ceinture. Commencez par « Ajouter un domaine ».</p>
            ) : (
              <div className="space-y-4">
                {ceinture.domaines.map((d) => {
                  const vide = d.competences.length === 0 && d.sousDomaines.length === 0 && d._count.progressions === 0;
                  return (
                    <div key={d.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-lg font-semibold">{d.nom}</h3>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" aria-label={`Renommer le domaine ${d.nom}`} onClick={() => ouvrir({ action: 'modifier', genre: 'domaines', id: d.id, texte: d.nom, evalue: 0 })}>Renommer</Button>
                          {vide && <Button size="sm" variant="ghost" aria-label={`Supprimer le domaine ${d.nom}`} onClick={() => ouvrir({ action: 'supprimer', genre: 'domaines', id: d.id, texte: d.nom })}>Supprimer</Button>}
                        </div>
                      </div>

                      {d.competences.length > 0 && (
                        <ul className="mt-2">
                          {d.competences.map((c) => (
                            <LigneCompetence key={c.id} c={c}
                              onModifier={() => ouvrir({ action: 'modifier', genre: 'competences', id: c.id, texte: c.libelle, evalue: c._count.notes })}
                              onSupprimer={() => ouvrir({ action: 'supprimer', genre: 'competences', id: c.id, texte: c.libelle })} />
                          ))}
                        </ul>
                      )}

                      {d.sousDomaines.map((s) => (
                        <div key={s.id} className="mt-3 border-l-2 border-border pl-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h4 className="text-base font-semibold">{s.nom}</h4>
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" variant="outline" aria-label={`Renommer le sous-domaine ${s.nom}`} onClick={() => ouvrir({ action: 'modifier', genre: 'sous-domaines', id: s.id, texte: s.nom, evalue: 0 })}>Renommer</Button>
                              {s.competences.length === 0 && <Button size="sm" variant="ghost" aria-label={`Supprimer le sous-domaine ${s.nom}`} onClick={() => ouvrir({ action: 'supprimer', genre: 'sous-domaines', id: s.id, texte: s.nom })}>Supprimer</Button>}
                            </div>
                          </div>
                          <ul className="mt-1">
                            {s.competences.map((c) => (
                              <LigneCompetence key={c.id} c={c}
                                onModifier={() => ouvrir({ action: 'modifier', genre: 'competences', id: c.id, texte: c.libelle, evalue: c._count.notes })}
                                onSupprimer={() => ouvrir({ action: 'supprimer', genre: 'competences', id: c.id, texte: c.libelle })} />
                            ))}
                          </ul>
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => ouvrir({ action: 'creer', genre: 'competences', parent: { sousDomaineId: s.id } })}>
                            Ajouter une compétence à « {s.nom} »
                          </Button>
                        </div>
                      ))}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => ouvrir({ action: 'creer', genre: 'competences', parent: { domaineId: d.id } })}>Ajouter une compétence</Button>
                        <Button size="sm" variant="outline" onClick={() => ouvrir({ action: 'creer', genre: 'sous-domaines', parent: { domaineId: d.id } })}>Ajouter un sous-domaine</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : ceinture.lecons.length === 0 ? (
            <p className="text-muted-foreground">Aucune leçon pour cette ceinture. Commencez par « Ajouter une leçon ».</p>
          ) : (
            <div className="space-y-4">
              {grouper(ceinture.lecons).map(([matId, mat]) => (
                <div key={matId} className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-2 text-lg font-semibold">{mat.nom}</h3>
                  {[...mat.rubriques.entries()].map(([rid, rub]) => (
                    <div key={rid} className="mt-3 first:mt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-base font-semibold">{rub.nom}</h4>
                        <Button size="sm" variant="outline" onClick={() => ouvrir({ action: 'creer', genre: 'lecons', parent: { ceintureId: ceinture.id, matiereId: matId, rubriqueId: rub.rubriqueId ?? undefined } })}>
                          Ajouter ici
                        </Button>
                      </div>
                      <ul className="mt-1">
                        {rub.lecons.map((l) => {
                          const utilisee = l._count.notes + l._count.progressions;
                          return (
                            <li key={l.id} className="flex items-start justify-between gap-3 border-t border-border py-2 first:border-t-0">
                              <span className="min-w-0 flex-1">
                                <span className="mr-2 text-muted-foreground">{l.ordre}.</span>{l.titre}
                                {utilisee > 0 && <Badge variant="secondary" className="ml-2">Utilisée · {utilisee}</Badge>}
                              </span>
                              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                                <Button size="sm" variant="outline" aria-label={`Modifier la leçon : ${l.titre}`} onClick={() => ouvrir({ action: 'modifier', genre: 'lecons', id: l.id, texte: l.titre, ordre: l.ordre, evalue: l._count.notes })}>Modifier</Button>
                                {utilisee === 0 && <Button size="sm" variant="ghost" aria-label={`Supprimer la leçon : ${l.titre}`} onClick={() => ouvrir({ action: 'supprimer', genre: 'lecons', id: l.id, texte: l.titre })}>Supprimer</Button>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {arbre.type === 'lecons' && (
        <details className="rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer text-lg font-semibold">Gérer les rubriques des matières</summary>
          <div className="mt-3 space-y-4">
            {matieres.map((m) => (
              <div key={m.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{m.nom}</h3>
                  <Button size="sm" variant="outline" onClick={() => ouvrir({ action: 'creer', genre: 'rubriques', parent: { matiereId: m.id } })}>Ajouter une rubrique</Button>
                </div>
                {m.rubriques.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune rubrique.</p>
                ) : (
                  <ul className="mt-1">
                    {m.rubriques.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0">
                        <span>{r.nom}<span className="ml-2 text-sm text-muted-foreground">{r._count.lecons} leçon(s)</span></span>
                        <span className="flex gap-1">
                          <Button size="sm" variant="outline" aria-label={`Renommer la rubrique ${r.nom}`} onClick={() => ouvrir({ action: 'modifier', genre: 'rubriques', id: r.id, texte: r.nom, evalue: 0 })}>Renommer</Button>
                          {r._count.lecons === 0 && <Button size="sm" variant="ghost" aria-label={`Supprimer la rubrique ${r.nom}`} onClick={() => ouvrir({ action: 'supprimer', genre: 'rubriques', id: r.id, texte: r.nom })}>Supprimer</Button>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <ModaleCrud
        ouvert={!!mAff}
        titre={!mAff || !textes ? '' : mAff.action === 'creer' ? textes.nouveau : mAff.action === 'modifier' ? textes.modifier : textes.supprimer}
        description={mAff?.action === 'modifier' && mAff.evalue > 0
          ? `Déjà évaluée pour ${mAff.evalue} élève(s) : corrigez seulement le texte (faute, précision). Le sens doit rester le même. L'ancien texte est conservé dans le journal.`
          : mAff?.action === 'supprimer' ? 'Cette action est définitive.' : ''}
        libelleValider={mAff?.action === 'supprimer' ? 'Supprimer' : mAff?.action === 'creer' ? 'Ajouter' : 'Enregistrer'}
        destructif={mAff?.action === 'supprimer'}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setModale(null); }} onValider={valider}
      >
        {mAff?.action === 'supprimer' ? (
          <p className="text-base">Supprimer <strong>{mAff.texte}</strong> ?</p>
        ) : mAff && textes ? (
          <div className="space-y-3">
            {mAff.action === 'creer' && (mAff.genre === 'lecons' || mAff.genre === 'rubriques') && (
              <div className="space-y-1.5">
                <Label htmlFor="matiere" className="text-base">Matière</Label>
                <Select value={matiereId} onValueChange={(v) => { setMatiereId(v); setRubriqueId('aucune'); }}>
                  <SelectTrigger id="matiere" className="h-11 w-full text-base"><SelectValue placeholder="Choisir une matière" /></SelectTrigger>
                  <SelectContent>{matieres.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {mAff.action === 'creer' && mAff.genre === 'lecons' && (
              <div className="space-y-1.5">
                <Label htmlFor="rubrique" className="text-base">Rubrique</Label>
                <Select value={rubriqueId} onValueChange={setRubriqueId} disabled={!matiereId}>
                  <SelectTrigger id="rubrique" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucune">Sans rubrique</SelectItem>
                    {rubriquesDeLaMatiere.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="texte" className="text-base">{textes.champ}</Label>
              {textes.long ? (
                <textarea id="texte" value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={1000} rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" />
              ) : (
                <Input id="texte" value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={mAff.genre === 'lecons' ? 500 : 150} className="h-11 text-base" />
              )}
            </div>
            {mAff.genre === 'lecons' && (
              <div className="w-40 space-y-1.5">
                <Label htmlFor="ordre" className="text-base">Ordre (facultatif)</Label>
                <Input id="ordre" inputMode="numeric" value={ordre} onChange={(e) => setOrdre(e.target.value)} placeholder="Automatique" className="h-11 text-base" />
              </div>
            )}
          </div>
        ) : null}
      </ModaleCrud>
    </div>
  );
}
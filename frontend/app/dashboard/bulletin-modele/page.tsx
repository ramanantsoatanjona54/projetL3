'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { NiveauProgramme } from '@/lib/types';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TypeElement = 'DISCIPLINE' | 'RUBRIQUE' | 'LIGNE';

interface Noeud {
  id: number;
  type: TypeElement;
  libelle: string;
  archive: boolean;
  evaluations: number;
  enfants: Noeud[];
}
interface SemestreModele { id: number; numero: number; disciplines: Noeud[] }
interface ArbreModele { niveau: { id: number; nom: string; classe: { nom: string } }; semestres: SemestreModele[] }
interface SemestreListe { id: number; numero: number; niveau: string; classe: string; elements: number }

type Modale =
  | { action: 'creer'; type: TypeElement; semestreId: number; parentId?: number; ou: string }
  | { action: 'modifier'; id: number; type: TypeElement; libelle: string }
  | { action: 'supprimer'; id: number; libelle: string };
type Deplacement = { id: number; type: TypeElement; libelle: string; parentActuelId: number | null };
type Confirmation = { titre: string; description: string; libelle: string; destructif: boolean; executer: () => Promise<unknown> };

const NOMS: Record<TypeElement, { nouveau: string; champ: string }> = {
  DISCIPLINE: { nouveau: 'Nouvelle discipline', champ: 'Nom de la discipline' },
  RUBRIQUE: { nouveau: 'Nouvelle rubrique', champ: 'Nom de la rubrique' },
  LIGNE: { nouveau: 'Nouvelle ligne à évaluer', champ: 'Texte de la ligne (ce que l’élève sait faire)' },
};

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function ContenuBulletin() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const autorise = role === 'ADMIN' || role === 'DIRECTRICE';
  const ecriture = role === 'ADMIN'; // la direction consulte, l'administrateur modifie

  const [niveaux, setNiveaux] = useState<NiveauProgramme[]>([]);
  const [niveauId, setNiveauId] = useState('');
  const [numero, setNumero] = useState(1);
  const [arbre, setArbre] = useState<ArbreModele | null>(null);
  const [erreurPage, setErreurPage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [modale, setModale] = useState<Modale | null>(null);
  const [deplacement, setDeplacement] = useState<Deplacement | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copie, setCopie] = useState<{ cibleId: number } | null>(null);
  const [sources, setSources] = useState<SemestreListe[]>([]);
  const [choix, setChoix] = useState('');
  const [texte, setTexte] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async (id: string) => {
    if (!id) return;
    try { setArbre(await api.get<ArbreModele>(`/bulletin-modeles/niveaux/${id}`)); setErreurPage(null); }
    catch (e) { setErreurPage(messageErreur(e)); }
  }, []);

  useEffect(() => {
    if (!autorise) return;
    api.get<NiveauProgramme[]>('/programmes/niveaux')
      .then((n) => { setNiveaux(n); if (n.length > 0) setNiveauId(String(n[0].id)); })
      .catch((e) => setErreurPage(messageErreur(e)));
  }, [autorise]);

  useEffect(() => { void charger(niveauId); }, [niveauId, charger]);

  const semestre = arbre?.semestres.find((s) => s.numero === numero) ?? arbre?.semestres[0];

  function reinitialiser() { setErreur(null); setInfo(null); }

  // Action directe (ordre) : pas de fenêtre, le résultat se voit tout de suite
  async function action(requete: () => Promise<unknown>) {
    reinitialiser();
    try { await requete(); await charger(niveauId); }
    catch (e) { setInfo(null); setErreurPage(null); setErreur(messageErreur(e)); }
  }

  function ouvrir(m: Modale) {
    setModale(m); reinitialiser();
    setTexte(m.action === 'modifier' ? m.libelle : '');
  }

  async function valider() {
    if (!modale) return;
    const t = texte.trim();
    if (modale.action !== 'supprimer' && !t) { setErreur('Ce champ est obligatoire.'); return; }
    setEnCours(true); setErreur(null);
    try {
      if (modale.action === 'creer') {
        await api.post('/bulletin-modeles/elements', { semestreId: modale.semestreId, parentId: modale.parentId, type: modale.type, libelle: t });
      } else if (modale.action === 'modifier') {
        await api.patch(`/bulletin-modeles/elements/${modale.id}`, { libelle: t });
      } else {
        await api.delete(`/bulletin-modeles/elements/${modale.id}`);
      }
      setInfo(modale.action === 'creer' ? 'Ajout enregistré.' : modale.action === 'modifier' ? 'Modification enregistrée.' : 'Suppression effectuée.');
      setModale(null);
      await charger(niveauId);
    } catch (e) { setErreur(messageErreur(e)); } finally { setEnCours(false); }
  }

  // Parents possibles pour un déplacement : rubriques et disciplines du semestre (jamais archivées)
  function destinations(d: Deplacement): { id: number; libelle: string }[] {
    if (!semestre) return [];
    const res: { id: number; libelle: string }[] = [];
    semestre.disciplines.forEach((disc, i) => {
      if (disc.archive) return;
      const nom = `${LETTRES[i] ?? '·'} - ${disc.libelle}`;
      if (d.type === 'LIGNE') res.push({ id: disc.id, libelle: `${nom} (directement sous la discipline)` });
      if (d.type === 'RUBRIQUE') res.push({ id: disc.id, libelle: nom });
      if (d.type === 'LIGNE') disc.enfants.filter((r) => r.type === 'RUBRIQUE' && !r.archive).forEach((r) => res.push({ id: r.id, libelle: `${nom} › ${r.libelle}` }));
    });
    return res.filter((x) => x.id !== d.parentActuelId);
  }

  async function validerDeplacement() {
    if (!deplacement) return;
    if (!choix) { setErreur('Choisissez la destination.'); return; }
    setEnCours(true); setErreur(null);
    try {
      await api.post(`/bulletin-modeles/elements/${deplacement.id}/deplacer`, { parentId: Number(choix) });
      setDeplacement(null); setInfo('Déplacement effectué.'); await charger(niveauId);
    } catch (e) { setErreur(messageErreur(e)); } finally { setEnCours(false); }
  }

  async function ouvrirCopie(cibleId: number) {
    reinitialiser(); setChoix('');
    try {
      const toutes = await api.get<SemestreListe[]>('/bulletin-modeles/semestres');
      setSources(toutes.filter((s) => s.id !== cibleId && s.elements > 0));
      setCopie({ cibleId });
    } catch (e) { setErreurPage(messageErreur(e)); }
  }

  async function validerCopie() {
    if (!copie) return;
    if (!choix) { setErreur('Choisissez le semestre à copier.'); return; }
    setEnCours(true); setErreur(null);
    try {
      await api.post(`/bulletin-modeles/semestres/${copie.cibleId}/copier`, { depuisSemestreId: Number(choix) });
      setCopie(null); setInfo('Structure copiée. Vous pouvez maintenant l’adapter.'); await charger(niveauId);
    } catch (e) { setErreur(messageErreur(e)); } finally { setEnCours(false); }
  }

  async function validerConfirmation() {
    if (!confirmation) return;
    setEnCours(true); setErreur(null);
    try {
      await confirmation.executer();
      setConfirmation(null); setInfo('Opération effectuée.'); await charger(niveauId);
    } catch (e) { setErreur(messageErreur(e)); } finally { setEnCours(false); }
  }

  function archiverOuRestaurer(n: Noeud) {
    setConfirmation(n.archive
      ? {
        titre: 'Restaurer', description: `« ${n.libelle} » sera de nouveau exigé dans les bulletins.`, libelle: 'Restaurer', destructif: false,
        executer: () => api.post(`/bulletin-modeles/elements/${n.id}/restaurer`, {}),
      }
      : {
        titre: 'Archiver', destructif: true, libelle: 'Archiver',
        description: `« ${n.libelle} »${n.enfants.length ? ' et tout ce qu’il contient' : ''} ne sera plus exigé pour les nouveaux bulletins. Les bulletins déjà remplis le conservent.`,
        executer: () => api.post(`/bulletin-modeles/elements/${n.id}/archiver`, {}),
      });
    reinitialiser();
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cet écran est réservé à l&apos;administration et à la direction.</AlertDescription></Alert>;
  }
  if (erreurPage) return <Alert variant="destructive" role="alert"><AlertDescription>{erreurPage}</AlertDescription></Alert>;
  if (!arbre) return <p className="text-muted-foreground">Chargement...</p>;

  // Boutons d'un élément : ordre, modification, ajouts, déplacement, archivage, suppression
  function Boutons({ n, i, total, semestreId, parentId }: { n: Noeud; i: number; total: number; semestreId: number; parentId: number | null }) {
    if (!ecriture) return null;
    const supprimable = n.enfants.length === 0 && n.evaluations === 0;
    return (
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="ghost" disabled={i === 0} aria-label={`Monter : ${n.libelle}`} onClick={() => void action(() => api.post(`/bulletin-modeles/elements/${n.id}/ordre`, { sens: 'haut' }))}>↑</Button>
        <Button size="sm" variant="ghost" disabled={i === total - 1} aria-label={`Descendre : ${n.libelle}`} onClick={() => void action(() => api.post(`/bulletin-modeles/elements/${n.id}/ordre`, { sens: 'bas' }))}>↓</Button>
        <Button size="sm" variant="outline" aria-label={`Modifier : ${n.libelle}`} onClick={() => ouvrir({ action: 'modifier', id: n.id, type: n.type, libelle: n.libelle })}>Modifier</Button>
        {n.type === 'DISCIPLINE' && !n.archive && (
          <Button size="sm" variant="outline" onClick={() => ouvrir({ action: 'creer', type: 'RUBRIQUE', semestreId, parentId: n.id, ou: n.libelle })}>Ajouter une rubrique</Button>
        )}
        {n.type !== 'LIGNE' && !n.archive && (
          <Button size="sm" variant="outline" onClick={() => ouvrir({ action: 'creer', type: 'LIGNE', semestreId, parentId: n.id, ou: n.libelle })}>Ajouter une ligne</Button>
        )}
        {n.type !== 'DISCIPLINE' && !n.archive && (
          <Button size="sm" variant="outline" aria-label={`Déplacer : ${n.libelle}`}
            onClick={() => { setDeplacement({ id: n.id, type: n.type, libelle: n.libelle, parentActuelId: parentId }); setChoix(''); reinitialiser(); }}>Déplacer</Button>
        )}
        <Button size="sm" variant="ghost" aria-label={`${n.archive ? 'Restaurer' : 'Archiver'} : ${n.libelle}`} onClick={() => archiverOuRestaurer(n)}>{n.archive ? 'Restaurer' : 'Archiver'}</Button>
        {supprimable && <Button size="sm" variant="ghost" aria-label={`Supprimer : ${n.libelle}`} onClick={() => ouvrir({ action: 'supprimer', id: n.id, libelle: n.libelle })}>Supprimer</Button>}
      </div>
    );
  }

  function Ligne({ n, rang, i, total, semestreId, parentId }: { n: Noeud; rang: number; i: number; total: number; semestreId: number; parentId: number | null }) {
    return (
      <li className={`flex flex-wrap items-start justify-between gap-2 border-t border-border py-2 first:border-t-0 ${n.archive ? 'opacity-60' : ''}`}>
        <span className="min-w-0 flex-1">
          <span className="mr-2 text-muted-foreground">{rang} -</span>{n.libelle}
          {n.evaluations > 0 && <Badge variant="secondary" className="ml-2">Évaluée · {n.evaluations}</Badge>}
          {n.archive && <Badge variant="outline" className="ml-2">Archivée</Badge>}
        </span>
        <Boutons n={n} i={i} total={total} semestreId={semestreId} parentId={parentId} />
      </li>
    );
  }

  // Les lignes sont numérotées dans leur groupe (1, 2, 3...), comme sur le bulletin papier
  function Contenu({ enfants, semestreId, parentId }: { enfants: Noeud[]; semestreId: number; parentId: number }) {
    let rang = 0;
    return (
      <>
        {enfants.map((c, i) => {
          if (c.type === 'LIGNE') {
            rang++;
            return <ul key={c.id} className="mt-1"><Ligne n={c} rang={rang} i={i} total={enfants.length} semestreId={semestreId} parentId={parentId} /></ul>;
          }
          return (
            <div key={c.id} className={`mt-3 border-l-2 border-border pl-3 ${c.archive ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="text-base font-semibold">
                  {c.libelle}
                  {c.archive && <Badge variant="outline" className="ml-2">Archivée</Badge>}
                </h4>
                <Boutons n={c} i={i} total={enfants.length} semestreId={semestreId} parentId={parentId} />
              </div>
              <Contenu enfants={c.enfants} semestreId={semestreId} parentId={c.id} />
            </div>
          );
        })}
      </>
    );
  }

  const destinationsDispo = deplacement ? destinations(deplacement) : [];
  const typeModale = modale && modale.action !== 'supprimer' ? modale.type : null;

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Contenu du bulletin</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {ecriture
          ? 'Les lignes ci-dessous sont évaluées par les enseignantes (A, EA, AR, NA) dans le bulletin de chaque élève. Une ligne déjà évaluée ne se supprime pas : on l’archive, elle n’est alors plus exigée pour les prochains bulletins.'
          : 'Consultation du contenu des bulletins. Seul l’administrateur peut le modifier.'}
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="w-60 space-y-1.5">
          <Label htmlFor="niveau" className="text-base">Niveau</Label>
          <Select value={niveauId} onValueChange={(v) => { setNiveauId(v); setArbre(null); setInfo(null); }}>
            <SelectTrigger id="niveau" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>{niveaux.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.classe.nom} · {n.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div role="group" aria-label="Semestre" className="flex gap-2">
          {arbre.semestres.map((s) => (
            <Button key={s.id} variant={s.numero === semestre?.numero ? 'default' : 'outline'} aria-pressed={s.numero === semestre?.numero} onClick={() => setNumero(s.numero)} className="h-11">
              Semestre {s.numero}
            </Button>
          ))}
        </div>
        {ecriture && semestre && (
          <Button onClick={() => ouvrir({ action: 'creer', type: 'DISCIPLINE', semestreId: semestre.id, ou: `Semestre ${semestre.numero}` })}>Ajouter une discipline</Button>
        )}
      </div>

      <div aria-live="polite">
        {info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}
        {erreur && !modale && !deplacement && !copie && !confirmation && (
          <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>
        )}
      </div>

      {!semestre ? (
        <Alert role="status"><AlertDescription>Aucun semestre n&apos;est défini pour ce niveau. Créez-le d&apos;abord dans « Programme pédagogique ».</AlertDescription></Alert>
      ) : semestre.disciplines.length === 0 ? (
        <Alert role="status">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Aucun contenu pour ce semestre.</span>
            {ecriture && <Button size="sm" variant="outline" onClick={() => void ouvrirCopie(semestre.id)}>Copier la structure d&apos;un autre semestre</Button>}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {semestre.disciplines.map((d, i) => (
            <section key={d.id} aria-labelledby={`disc-${d.id}`} className={`rounded-lg border border-border bg-card p-4 ${d.archive ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 id={`disc-${d.id}`} className="text-xl font-semibold">
                  {LETTRES[i] ?? '·'} - {d.libelle}
                  {d.archive && <Badge variant="outline" className="ml-2">Archivée</Badge>}
                </h2>
                <Boutons n={d} i={i} total={semestre.disciplines.length} semestreId={semestre.id} parentId={null} />
              </div>
              <Contenu enfants={d.enfants} semestreId={semestre.id} parentId={d.id} />
            </section>
          ))}
        </div>
      )}

      {/* Ajout, modification, suppression */}
      <ModaleCrud
        ouvert={!!modale}
        titre={!modale ? '' : modale.action === 'creer' ? NOMS[modale.type].nouveau : modale.action === 'modifier' ? 'Modifier' : 'Supprimer'}
        description={modale?.action === 'creer' ? `Dans : ${modale.ou}` : modale?.action === 'supprimer' ? 'Cette action est définitive.' : ''}
        libelleValider={modale?.action === 'supprimer' ? 'Supprimer' : modale?.action === 'creer' ? 'Ajouter' : 'Enregistrer'}
        destructif={modale?.action === 'supprimer'}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setModale(null); }} onValider={valider}
      >
        {modale?.action === 'supprimer' ? (
          <p className="text-base">Supprimer <strong>{modale.libelle}</strong> ?</p>
        ) : modale ? (
          <div className="space-y-1.5">
            <Label htmlFor="texte" className="text-base">{typeModale ? NOMS[typeModale].champ : ''}</Label>
            {typeModale === 'LIGNE' ? (
              <textarea id="texte" value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={300} rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base" />
            ) : (
              <Input id="texte" value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={300} className="h-11 text-base" />
            )}
            <p className="text-sm text-muted-foreground">Écrivez le texte sans numéro ni lettre : ils se calculent à l&apos;affichage.</p>
          </div>
        ) : null}
      </ModaleCrud>

      {/* Déplacement */}
      <ModaleCrud
        ouvert={!!deplacement} titre="Déplacer"
        description="La destination doit être dans le même semestre. Les évaluations déjà saisies suivent l’élément."
        libelleValider="Déplacer" enCours={enCours} erreur={erreur}
        onFermer={() => { if (!enCours) setDeplacement(null); }} onValider={validerDeplacement}
      >
        {deplacement && (
          <div className="space-y-3">
            <p className="text-base">Déplacer <strong>{deplacement.libelle}</strong></p>
            <div className="space-y-1.5">
              <Label htmlFor="destination" className="text-base">Vers</Label>
              <Select value={choix} onValueChange={setChoix}>
                <SelectTrigger id="destination" className="h-11 w-full text-base"><SelectValue placeholder="Choisir la destination" /></SelectTrigger>
                <SelectContent>{destinationsDispo.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.libelle}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}
      </ModaleCrud>

      {/* Copie d'une structure */}
      <ModaleCrud
        ouvert={!!copie} titre="Copier la structure"
        description="Disciplines, rubriques et lignes sont copiées telles quelles ; vous les adaptez ensuite. Aucune évaluation n’est copiée."
        libelleValider="Copier" enCours={enCours} erreur={erreur}
        onFermer={() => { if (!enCours) setCopie(null); }} onValider={validerCopie}
      >
        <div className="space-y-1.5">
          <Label htmlFor="source" className="text-base">Copier depuis</Label>
          <Select value={choix} onValueChange={setChoix}>
            <SelectTrigger id="source" className="h-11 w-full text-base"><SelectValue placeholder="Choisir un semestre" /></SelectTrigger>
            <SelectContent>
              {sources.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.classe} · {s.niveau} · Semestre {s.numero} ({s.elements} éléments)</SelectItem>)}
            </SelectContent>
          </Select>
          {sources.length === 0 && <p className="text-sm text-muted-foreground">Aucun autre semestre n&apos;a de contenu à copier.</p>}
        </div>
      </ModaleCrud>

      {/* Confirmation (archivage, restauration) */}
      <ModaleCrud
        ouvert={!!confirmation} titre={confirmation?.titre ?? ''} description={confirmation?.description ?? ''}
        libelleValider={confirmation?.libelle ?? 'Valider'} destructif={confirmation?.destructif}
        enCours={enCours} erreur={erreur} onFermer={() => { if (!enCours) setConfirmation(null); }} onValider={validerConfirmation}
      >
        <p className="text-base">Confirmer cette opération ?</p>
      </ModaleCrud>
    </div>
  );
}
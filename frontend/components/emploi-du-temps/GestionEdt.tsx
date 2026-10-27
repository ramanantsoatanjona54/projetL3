'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { CreneauEdt, EdtSalle, SalleEdt } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { GrilleEdt } from './GrilleEdt';

const AUCUN = 'aucun';
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const VIDE = { jour: '1', debut: '08:00', fin: '09:00', matiere: AUCUN, enseignant: AUCUN, titre: '' };

export function GestionEdt({ peutGerer }: { peutGerer: boolean }) {
  const [salles, setSalles] = useState<SalleEdt[]>([]);
  const [choix, setChoix] = useState(''); // « salleId-niveauId »
  const [edt, setEdt] = useState<EdtSalle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [edition, setEdition] = useState<CreneauEdt | 'nouveau' | null>(null);
  const [form, setForm] = useState(VIDE);
  const [aSupprimer, setASupprimer] = useState<CreneauEdt | null>(null);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Une salle qui regroupe plusieurs niveaux donne plusieurs emplois du temps : « 3A · 9e », « 3A · 8e »...
  const options = useMemo(
    () => salles.flatMap((s) => s.niveaux.map((n) => ({ valeur: `${s.id}-${n.id}`, libelle: `${s.nom} · ${n.nom}` }))),
    [salles],
  );

  useEffect(() => {
    api.get<SalleEdt[]>('/emploi-du-temps/salles').then(setSalles).catch((e) => setErreur(messageErreur(e)));
  }, []);

  const charger = useCallback(() => {
    if (!choix) return;
    const [salleId, niveauId] = choix.split('-');
    api.get<EdtSalle>(`/emploi-du-temps?salleId=${salleId}&niveauId=${niveauId}`)
      .then((d) => { setEdt(d); setErreur(null); })
      .catch((e) => setErreur(messageErreur(e)));
  }, [choix]);
  useEffect(() => { setEdt(null); setInfo(null); charger(); }, [charger]);

  function ouvrir(c: CreneauEdt | 'nouveau') {
    setForm(c === 'nouveau' ? VIDE : {
      jour: String(c.jourSemaine), debut: c.heureDebut, fin: c.heureFin,
      matiere: c.matiere ? String(c.matiere.id) : AUCUN,
      enseignant: c.enseignant ? String(c.enseignant.id) : AUCUN,
      titre: c.titre ?? '',
    });
    setErreurModale(null); setEdition(c);
  }

  async function enregistrer() {
    if (!edt) return;
    if (!form.debut || !form.fin) { setErreurModale('Indiquez les heures de début et de fin.'); return; }
    if (form.debut >= form.fin) { setErreurModale("L'heure de fin doit suivre l'heure de début."); return; }
    if (form.matiere === AUCUN && !form.titre.trim()) { setErreurModale('Choisissez une matière ou donnez un titre (ex. Récréation).'); return; }
    setEnCours(true); setErreurModale(null);
    const corps = {
      jourSemaine: Number(form.jour), heureDebut: form.debut, heureFin: form.fin,
      matiereId: form.matiere === AUCUN ? null : Number(form.matiere),
      enseignantId: form.enseignant === AUCUN ? null : Number(form.enseignant),
      titre: form.titre.trim() || null,
    };
    try {
      if (edition === 'nouveau') {
        await api.post('/emploi-du-temps', { salleId: edt.salle.id, niveauId: edt.niveau.id, ...corps });
        setInfo('Créneau ajouté.');
      } else if (edition) {
        await api.patch(`/emploi-du-temps/${edition.id}`, corps);
        setInfo('Créneau modifié.');
      }
      setEdition(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setEnCours(true); setErreurModale(null);
    try {
      await api.delete(`/emploi-du-temps/${aSupprimer.id}`);
      setInfo('Créneau supprimé.');
      setASupprimer(null);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-64 space-y-1.5">
          <Label htmlFor="edt-salle" className="text-base">Salle et niveau</Label>
          <Select value={choix} onValueChange={setChoix}>
            <SelectTrigger id="edt-salle" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o.valeur} value={o.valeur}>{o.libelle}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {peutGerer && edt && <Button size="lg" onClick={() => ouvrir('nouveau')}>Ajouter un créneau</Button>}
      </div>

      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      {!choix && <p className="text-muted-foreground">Choisissez une salle et un niveau pour voir son emploi du temps.</p>}
      {edt && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">Salle {edt.salle.nom} · {edt.niveau.nom} · Année {edt.annee.libelle}</p>
          <GrilleEdt
            creneaux={edt.creneaux}
            onModifier={peutGerer ? ouvrir : undefined}
            onSupprimer={peutGerer ? (c) => { setASupprimer(c); setErreurModale(null); } : undefined}
          />
        </>
      )}

      <ModaleCrud
        ouvert={edition !== null} titre={edition === 'nouveau' ? 'Nouveau créneau' : 'Modifier le créneau'}
        description={edt ? `Salle ${edt.salle.nom} · ${edt.niveau.nom}` : ''} libelleValider="Enregistrer"
        enCours={enCours} erreur={erreurModale} onFermer={() => { if (!enCours) setEdition(null); }} onValider={enregistrer}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="edt-jour" className="text-base">Jour *</Label>
              <Select value={form.jour} onValueChange={(v) => setForm((f) => ({ ...f, jour: v }))}>
                <SelectTrigger id="edt-jour" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>{JOURS.map((j, i) => <SelectItem key={j} value={String(i + 1)}>{j}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edt-debut" className="text-base">Début *</Label>
              <Input id="edt-debut" type="time" step={900} min="07:00" max="18:00" value={form.debut}
                onChange={(e) => setForm((f) => ({ ...f, debut: e.target.value }))} className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edt-fin" className="text-base">Fin *</Label>
              <Input id="edt-fin" type="time" step={900} min="07:00" max="18:00" value={form.fin}
                onChange={(e) => setForm((f) => ({ ...f, fin: e.target.value }))} className="h-11 text-base" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edt-matiere" className="text-base">Matière</Label>
            <Select value={form.matiere} onValueChange={(v) => setForm((f) => ({ ...f, matiere: v }))}>
              <SelectTrigger id="edt-matiere" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Aucune (activité libre)</SelectItem>
                {edt?.matieres.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edt-ens" className="text-base">Enseignant (de cette salle)</Label>
            <Select value={form.enseignant} onValueChange={(v) => setForm((f) => ({ ...f, enseignant: v }))}>
              <SelectTrigger id="edt-ens" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Non précisé</SelectItem>
                {edt?.enseignantsPossibles.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.prenom} {p.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edt-titre" className="text-base">Titre (si pas de matière, ex. Récréation)</Label>
            <Input id="edt-titre" maxLength={60} value={form.titre}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} className="h-11 text-base" />
          </div>
        </div>
      </ModaleCrud>

      <ModaleCrud
        ouvert={!!aSupprimer} titre="Supprimer ce créneau ?"
        description={aSupprimer ? `${JOURS[aSupprimer.jourSemaine - 1]} ${aSupprimer.heureDebut}–${aSupprimer.heureFin}` : ''}
        libelleValider="Supprimer" destructif enCours={enCours} erreur={erreurModale}
        onFermer={() => { if (!enCours) setASupprimer(null); }} onValider={supprimer}
      >
        <p className="text-sm text-muted-foreground">Cette action est définitive.</p>
      </ModaleCrud>
    </div>
  );
}
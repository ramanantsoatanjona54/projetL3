'use client';

import { useState } from 'react';
import { lireErreurHttp } from '@/lib/communication';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Modele = 'contrat' | 'avenant' | 'attestation';

const MODELES: { id: Modele; titre: string; aide: string }[] = [
  { id: 'contrat', titre: 'Contrat de travail (CDI)', aide: 'Contrat complet à faire signer à l’embauche.' },
  { id: 'avenant', titre: 'Avenant au contrat', aide: 'Modification de la rémunération ou de l’ancienneté.' },
  { id: 'attestation', titre: 'Attestation d’emploi', aide: 'Document remis à l’agent pour ses démarches.' },
];

interface Formulaire {
  lieuNaissance: string; cinDelivrance: string; pere: string; mere: string; classification: string;
  dateEffet: string; salaireBase: string; anciennete: string; natureContrat: 'CDI' | 'CDD';
}
const VIDE: Formulaire = {
  lieuNaissance: '', cinDelivrance: '', pere: '', mere: '', classification: '4B',
  dateEffet: '', salaireBase: '', anciennete: '0', natureContrat: 'CDI',
};

function Champ(props: { id: string; label: string; valeur: string; onChange: (v: string) => void; type?: string; aide?: string; requis?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id} className="text-base">{props.label}{props.requis ? ' *' : ''}</Label>
      <Input
        id={props.id} type={props.type ?? 'text'} value={props.valeur} onChange={(e) => props.onChange(e.target.value)}
        className="h-11 text-base" aria-describedby={props.aide ? `${props.id}-aide` : undefined}
        inputMode={props.type === 'number' ? 'numeric' : undefined} min={props.type === 'number' ? 0 : undefined}
      />
      {props.aide && <p id={`${props.id}-aide`} className="text-sm text-muted-foreground">{props.aide}</p>}
    </div>
  );
}

// Trois modèles Word préremplis avec les données de l'agent (fiche + formulaire)
export function DocumentsRh({ personnelId, nomAgent }: { personnelId: number; nomAgent: string }) {
  const [modele, setModele] = useState<Modele | null>(null);
  const [f, setF] = useState<Formulaire>(VIDE);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const maj = (k: keyof Formulaire) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  function ouvrir(m: Modele) { setModele(m); setErreur(null); setInfo(null); }

  async function generer() {
    if (!modele) return;
    setErreur(null);
    const corps: Record<string, unknown> = {};
    const texte = (k: keyof Formulaire) => { const v = f[k].trim(); if (v) corps[k] = v; };
    texte('lieuNaissance');
    if (modele === 'contrat') { texte('pere'); texte('mere'); texte('classification'); }
    if (modele === 'avenant') texte('cinDelivrance');
    if (modele === 'attestation') corps.natureContrat = f.natureContrat;
    if (f.dateEffet) corps.dateEffet = f.dateEffet;
    if (modele !== 'attestation') {
      if (f.salaireBase.trim() === '' || !/^\d+$/.test(f.salaireBase.trim())) { setErreur('Le salaire mensuel de base doit être un nombre entier en Ariary.'); return; }
      corps.salaireBase = Number(f.salaireBase);
    }
    if (modele === 'avenant') {
      if (!/^\d+$/.test(f.anciennete.trim())) { setErreur('L’ancienneté doit être un nombre entier en Ariary (0 si aucune).'); return; }
      corps.anciennete = Number(f.anciennete);
      if (!f.dateEffet) { setErreur('La date d’effet est obligatoire pour l’avenant.'); return; }
    }

    setEnCours(true);
    try {
      const r = await fetch(`/api/rh/documents/${personnelId}/${modele}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
      });
      if (!r.ok) { setErreur(await lireErreurHttp(r)); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${MODELES.find((m) => m.id === modele)?.titre ?? 'Document'} - ${nomAgent}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setInfo('Document généré : vérifiez-le dans Word avant de le faire signer.');
      setModele(null);
    } catch {
      setErreur('La génération a échoué. Vérifiez votre connexion et réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  const courant = MODELES.find((m) => m.id === modele);

  return (
    <section aria-labelledby="docs-rh" className="rounded-lg border border-border bg-card p-5">
      <h2 id="docs-rh" className="text-xl font-semibold">Documents Word</h2>
      <p className="mb-4 text-sm text-muted-foreground">Préremplis avec les informations de {nomAgent}. Seul le comptable, la Direction et l’administrateur y ont accès.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {MODELES.map((m) => (
          <div key={m.id} className="flex flex-col justify-between gap-3 rounded-md border border-border p-4">
            <div>
              <p className="font-medium">{m.titre}</p>
              <p className="text-sm text-muted-foreground">{m.aide}</p>
            </div>
            <Button variant="outline" onClick={() => ouvrir(m.id)}>Préparer<span className="sr-only"> : {m.titre}</span></Button>
          </div>
        ))}
      </div>
      <div aria-live="polite">{info && <Alert role="status" className="mt-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      <ModaleCrud
        ouvert={modele !== null} titre={courant?.titre ?? ''}
        description="Complétez les informations qui ne figurent pas dans la fiche de l’agent. Le fichier Word se télécharge ensuite."
        libelleValider="Générer le document Word" enCours={enCours} erreur={erreur}
        onFermer={() => { if (!enCours) setModele(null); }} onValider={generer}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {modele !== 'attestation' && (
            <Champ id="dr-salaire" label="Salaire mensuel de base (Ar)" valeur={f.salaireBase} onChange={maj('salaireBase')} type="number" requis />
          )}
          {modele === 'avenant' && (
            <Champ id="dr-anc" label="Ancienneté (Ar)" valeur={f.anciennete} onChange={maj('anciennete')} type="number" requis aide="0 s’il n’y en a pas." />
          )}
          {modele !== 'attestation' && (
            <Champ
              id="dr-effet" label={modele === 'contrat' ? 'Date de prise de service' : 'Date d’effet'} valeur={f.dateEffet} onChange={maj('dateEffet')} type="date"
              requis={modele === 'avenant'} aide={modele === 'contrat' ? 'Par défaut : la date d’embauche de la fiche.' : undefined}
            />
          )}
          {modele === 'contrat' && (
            <Champ id="dr-classif" label="Classification" valeur={f.classification} onChange={maj('classification')} requis aide="Exemple : 4B." />
          )}
          <Champ id="dr-lieu" label="Lieu de naissance" valeur={f.lieuNaissance} onChange={maj('lieuNaissance')} aide="Facultatif : omis du document s’il est vide." />
          {modele === 'avenant' && (
            <Champ id="dr-cin" label="Délivrance de la CIN" valeur={f.cinDelivrance} onChange={maj('cinDelivrance')} aide="Exemple : délivrée à Antananarivo I le 21 mai 1986." />
          )}
          {modele === 'contrat' && (
            <>
              <Champ id="dr-pere" label="Père" valeur={f.pere} onChange={maj('pere')} />
              <Champ id="dr-mere" label="Mère" valeur={f.mere} onChange={maj('mere')} />
            </>
          )}
          {modele === 'attestation' && (
            <div className="space-y-1.5">
              <Label htmlFor="dr-nature" className="text-base">Nature du contrat</Label>
              <Select value={f.natureContrat} onValueChange={(v) => setF((x) => ({ ...x, natureContrat: v as 'CDI' | 'CDD' }))}>
                <SelectTrigger id="dr-nature" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CDI">Durée indéterminée (CDI)</SelectItem>
                  <SelectItem value="CDD">Durée déterminée (CDD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ModaleCrud>
    </section>
  );
}
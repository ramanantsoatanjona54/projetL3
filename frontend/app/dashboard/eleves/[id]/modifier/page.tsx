'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Eleve } from '@/lib/types';
import { FormulaireEleve, type Champs } from '@/components/eleves/FormulaireEleve';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const t = (x?: string | number | null) => (x == null ? '' : String(x));
const jour = (x?: string | null) => (x ? x.slice(0, 10) : '');

function versChamps(e: Eleve): Champs {
  return {
    nom: e.nom, prenom: e.prenom, sexe: e.sexe, dateNaissance: jour(e.dateNaissance),
    numeroInscription: t(e.numeroInscription), dateInscription: jour(e.dateInscription),
    taille: t(e.taille), assurance: t(e.assurance), assuranceExpiration: jour(e.assuranceExpiration),
    dossiersManquants: t(e.dossiersManquants), telephone: t(e.telephone), email1: t(e.email1),
    email2: t(e.email2), quartier: t(e.quartier), professionPere: t(e.professionPere),
    professionMere: t(e.professionMere),
  };
}

export default function ModifierEleve() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [eleve, setEleve] = useState<Eleve | null>(null);
  const [etat, setEtat] = useState<'chargement' | 'ok' | 'erreur'>('chargement');

  useEffect(() => {
    api.get<Eleve | undefined>(`/eleves/${id}`)
      .then((d) => { if (d) { setEleve(d); setEtat('ok'); } else setEtat('erreur'); })
      .catch(() => setEtat('erreur'));
  }, [id]);

  if (etat === 'chargement') return <p className="text-muted-foreground">Chargement...</p>;
  if (etat === 'erreur' || !eleve) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive"><AlertDescription>Impossible de charger cet élève.</AlertDescription></Alert>
        <Button asChild variant="outline"><Link href="/dashboard/eleves">Retour à la liste</Link></Button>
      </div>
    );
  }

  return (
    <FormulaireEleve
      mode="modification"
      eleveId={eleve.id}
      matricule={eleve.matricule}
      initial={versChamps(eleve)}
      onSuccess={() => router.push(`/dashboard/eleves/${eleve.id}`)}
    />
  );
}
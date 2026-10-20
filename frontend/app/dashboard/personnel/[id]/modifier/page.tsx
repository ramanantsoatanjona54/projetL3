'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import { nomComplet } from '@/lib/personnel';
import type { PersonnelLigne } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormulairePersonnel } from '@/components/personnel/FormulairePersonnel';

export default function ModifierPersonnel() {
  const { id } = useParams<{ id: string }>();
  const [personnel, setPersonnel] = useState<PersonnelLigne | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<PersonnelLigne>(`/rh/personnel/${id}`).then(setPersonnel).catch((e) => setErreur(messageErreur(e)));
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/personnel" className="text-sm text-muted-foreground hover:underline">&larr; Retour au personnel</Link>
      <h1 className="mb-1 mt-2 text-3xl font-semibold">{personnel ? nomComplet(personnel) : 'Fiche du personnel'}</h1>
      {personnel && <p className="mb-6 text-sm text-muted-foreground">Matricule {personnel.matricule}</p>}
      {erreur && <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!personnel && !erreur && <p className="text-muted-foreground">Chargement...</p>}
      {personnel && <FormulairePersonnel personnel={personnel} />}
    </div>
  );
}
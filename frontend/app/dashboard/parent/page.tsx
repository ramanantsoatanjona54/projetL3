'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { ar, dateFr, nomMois } from '@/lib/format';
import { libelleLien, nomMoisNumero } from '@/lib/parent';
import type { EnfantParent, EspaceParent } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function CarteEnfant({ e }: { e: EnfantParent }) {
  const courante = e.inscriptions.find((i) => i.courante) ?? e.inscriptions[0];
  const anciennes = e.inscriptions.filter((i) => i !== courante && i.statut === 'validee');
  const r = courante?.resume ?? null;
  const aRegler = r ? r.exigible + r.penalitesEnCours : 0;
  const pourcentage = r && r.totalAnnuel > 0 ? Math.min(100, Math.round((r.totalPaye / r.totalAnnuel) * 100)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{e.prenom} {e.nom}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {libelleLien[e.lienParente] ?? e.lienParente} · Matricule {e.matricule} · Né(e) le {dateFr(e.dateNaissance)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!courante ? (
          <p className="text-muted-foreground">Aucune inscription en cours pour cet enfant.</p>
        ) : (
          <>
            <p className="text-base">
              Salle <strong>{courante.salle.nom}</strong> · {courante.niveau.nom} · Année {courante.anneeScolaire.libelle}
            </p>

            {courante.statut !== 'validee' ? (
              <Alert role="status">
                <AlertDescription>
                  Inscription en attente de validation par le secrétariat. Les paiements seront visibles après validation.
                </AlertDescription>
              </Alert>
            ) : !r ? (
              <p className="text-muted-foreground">La situation de paiement n&apos;est pas disponible pour le moment.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">À régler maintenant</p>
                    <p className="text-3xl font-semibold tabular-nums">{ar(aRegler)}</p>
                    {r.penalitesEnCours > 0 && (
                      <p className="text-sm text-muted-foreground">dont {ar(r.penalitesEnCours)} de pénalités de retard</p>
                    )}
                  </div>
                  {r.moisEnRetard.length > 0 ? (
                    <Badge variant="destructive">
                      {r.moisEnRetard.length} mois en retard : {r.moisEnRetard.map(nomMoisNumero).join(', ')}
                    </Badge>
                  ) : (
                    <Badge>À jour</Badge>
                  )}
                </div>

                {r.prochaine && r.moisEnRetard.length === 0 && (
                  <p className="text-sm">
                    Prochaine échéance : <strong>{nomMois(r.prochaine.limite)}</strong>, au plus tard le {dateFr(r.prochaine.limite)}
                    {' '}({ar(r.prochaine.montant)}).
                  </p>
                )}

                <div>
                  <div
                    role="progressbar" aria-label={`Écolage payé pour ${e.prenom}`} aria-valuemin={0} aria-valuemax={100}
                    aria-valuenow={pourcentage} className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full bg-primary" style={{ width: `${pourcentage}%` }} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ar(r.totalPaye)} payés sur {ar(r.totalAnnuel)} cette année ({pourcentage} %)
                  </p>
                </div>
              </div>
            )}

                        {courante.statut === 'validee' && (
              <div className="flex flex-wrap gap-3">
                <Link href={`/dashboard/parent/inscriptions/${courante.id}`} className={buttonVariants({ size: 'lg' })}>
                  Voir les paiements et les reçus
                </Link>
                <Link href={`/dashboard/parent/inscriptions/${courante.id}/absences`} className={buttonVariants({ size: 'lg', variant: 'outline' })}>
                  Voir les absences
                </Link>
              </div>
            )}
          </>
        )}

        {anciennes.length > 0 && (
          <div className="border-t border-border pt-3 text-sm">
            <p className="mb-1 text-muted-foreground">Années précédentes</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {anciennes.map((i) => (
                <li key={i.id}>
                  <Link href={`/dashboard/parent/inscriptions/${i.id}`} className="underline hover:text-primary">
                    {i.anneeScolaire.libelle}, salle {i.salle.nom}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MesEnfants() {
  const { utilisateur } = useAuth();
  const [donnees, setDonnees] = useState<EspaceParent | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const parent = utilisateur?.role === 'PARENT';

  useEffect(() => {
    if (!parent) return;
    api.get<EspaceParent>('/parent/enfants').then(setDonnees).catch((e) => setErreur(messageErreur(e)));
  }, [parent]);

  if (utilisateur && !parent) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cet espace est réservé aux parents.</AlertDescription></Alert>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-3xl font-semibold">
        {donnees?.parent ? `Bonjour, ${donnees.parent.prenom}` : 'Mes enfants'}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Retrouvez la scolarité et les paiements de vos enfants. Les règlements s&apos;effectuent auprès de l&apos;école.
      </p>

      {erreur && <Alert variant="destructive" role="alert" className="mb-6"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!donnees && !erreur && <p className="text-muted-foreground">Chargement...</p>}
      {donnees && donnees.enfants.length === 0 && (
        <Alert role="status"><AlertDescription>Aucun enfant n&apos;est rattaché à votre compte. Contactez le secrétariat.</AlertDescription></Alert>
      )}

      <div className="space-y-6">
        {donnees?.enfants.map((e) => <CarteEnfant key={e.id} e={e} />)}
      </div>
    </div>
  );
}
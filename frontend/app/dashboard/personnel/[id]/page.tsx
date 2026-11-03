'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { messageErreur } from '@/lib/messages';
import { ar, dateFr } from '@/lib/format';
import { libelleSalle, nomComplet } from '@/lib/personnel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { DocumentsRh } from '@/components/rh/DocumentsRh';

// Fiche complète renvoyée par GET /rh/personnel/:id
interface Fiche {
  id: number;
  matricule: string;
  typePersonnel?: 'SALARIE' | 'CONSULTANT';
  nom: string;
  prenom: string;
  sexe: string | null;
  dateNaissance: string | null;
  cin: string | null;
  adresse: string | null;
  telephone: string | null;
  indemniteTransportJour: string | number | null;
  numeroCnaps: string | null;
  nif?: string | null;
  numeroStatistique?: string | null;
  poste: string;
  salleAffectee: Parameters<typeof libelleSalle>[0] | null;
  lieuAffectation: string | null;
  autorisationEnseigner: boolean;
  banque: string | null;
  dateEmbauche: string;
  dateDepart: string | null;
  dateRetraite: string | null;
  utilisateur: { id: number; email: string; role: string; actif: boolean } | null;
}

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  const vide = children === null || children === undefined || children === '';
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{libelle}</dt>
      <dd className="break-words text-base">{vide ? <span className="text-muted-foreground">Non renseigné</span> : children}</dd>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section aria-label={titre} className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-xl font-semibold">{titre}</h2>
      <dl className="divide-y divide-border">{children}</dl>
    </section>
  );
}

export default function FicheAgent() {
  const { id } = useParams<{ id: string }>();
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ADMIN', 'COMPTABLE', 'DIRECTRICE'].includes(role);
  const [f, setF] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!autorise) return;
    api.get<Fiche>(`/rh/personnel/${id}`).then(setF).catch((e) => setErreur(messageErreur(e)));
  }, [id, autorise]);

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;administration.</AlertDescription></Alert>;
  }

  const consultant = f?.typePersonnel === 'CONSULTANT';
  const transport = f?.indemniteTransportJour != null && f.indemniteTransportJour !== '' ? Number(f.indemniteTransportJour) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/personnel" className="text-sm text-muted-foreground hover:underline">&larr; Retour au personnel</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{f ? nomComplet(f) : 'Fiche de l’agent'}</h1>
          {f && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Matricule {f.matricule}
              <Badge variant="outline">{consultant ? 'Consultant' : 'Salarié'}</Badge>
              {f.dateDepart && <Badge variant="secondary">Parti le {dateFr(f.dateDepart)}</Badge>}
            </p>
          )}
        </div>
        {f && role === 'ADMIN' && (
          <Link href={`/dashboard/personnel/${f.id}/modifier`} className={buttonVariants({ variant: 'outline' })}>Modifier la fiche</Link>
        )}
      </div>

      {erreur && <Alert variant="destructive" role="alert"><AlertDescription>{erreur}</AlertDescription></Alert>}
      {!f && !erreur && <p className="text-muted-foreground">Chargement...</p>}

      {f && (
        <div className="space-y-6">
          <Bloc titre="Identité">
            <Ligne libelle="Nom">{f.nom}</Ligne>
            <Ligne libelle="Prénoms">{f.prenom}</Ligne>
            <Ligne libelle="Sexe">{f.sexe === 'F' ? 'Féminin' : f.sexe === 'M' ? 'Masculin' : null}</Ligne>
            <Ligne libelle="Date de naissance">{f.dateNaissance ? dateFr(f.dateNaissance) : null}</Ligne>
            <Ligne libelle="CIN">{f.cin}</Ligne>
            <Ligne libelle="Adresse">{f.adresse}</Ligne>
            <Ligne libelle="Téléphone">{f.telephone}</Ligne>
          </Bloc>

          <Bloc titre="Fonction et affectation">
            <Ligne libelle="Fonction">{f.poste}</Ligne>
            <Ligne libelle="Salle / classe">{f.salleAffectee ? libelleSalle(f.salleAffectee) : null}</Ligne>
            <Ligne libelle="Lieu d’affectation">{f.lieuAffectation}</Ligne>
            <Ligne libelle="Autorisation d’enseigner">{f.autorisationEnseigner ? 'Oui' : 'Non'}</Ligne>
            <Ligne libelle={consultant ? 'Début de mission' : 'Date d’embauche'}>{dateFr(f.dateEmbauche)}</Ligne>
            {f.dateDepart && <Ligne libelle="Date de départ">{dateFr(f.dateDepart)}</Ligne>}
            {!consultant && <Ligne libelle="Date de retraite">{f.dateRetraite ? dateFr(f.dateRetraite) : null}</Ligne>}
          </Bloc>

          <Bloc titre="Rémunération et administratif">
            <Ligne libelle="Transport (par jour)">{transport !== null ? ar(transport) : null}</Ligne>
            <Ligne libelle="Banque">{f.banque}</Ligne>
            {consultant ? (
              <>
                <Ligne libelle="NIF">{f.nif}</Ligne>
                <Ligne libelle="Numéro statistique">{f.numeroStatistique}</Ligne>
              </>
            ) : (
              <Ligne libelle="Numéro CNaPS">{f.numeroCnaps}</Ligne>
            )}
          </Bloc>

          <Bloc titre="Compte d’accès">
            {f.utilisateur ? (
              <>
                <Ligne libelle="E-mail">{f.utilisateur.email}</Ligne>
                <Ligne libelle="Rôle">{f.utilisateur.role}</Ligne>
                <Ligne libelle="État">{f.utilisateur.actif ? 'Actif' : 'Désactivé'}</Ligne>
              </>
            ) : (
              <Ligne libelle="Compte">Aucun compte lié</Ligne>
            )}
          </Bloc>

          {consultant ? (
            <Alert role="status">
              <AlertDescription>Le contrat de travail, l’avenant et l’attestation d’emploi concernent les salariés. Ils ne sont pas proposés pour un consultant.</AlertDescription>
            </Alert>
          ) : (
            <DocumentsRh personnelId={f.id} nomAgent={nomComplet(f)} />
          )}
        </div>
      )}
    </div>
  );
}
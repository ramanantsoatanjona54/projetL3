
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { normaliser } from '@/lib/normaliser';
import type { Eleve } from '@/lib/types';
import { AjouterParent, type ResultatAjout } from '@/components/eleves/AjouterParent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const fr = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const LIENS: Record<string, string> = { pere: 'Père', mere: 'Mère', tuteur: 'Tuteur' };
const STATUTS: Record<string, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  annulee: 'Annulée',
};

function age(naissance: string) {
  const n = new Date(naissance);
  const auj = new Date();
  let a = auj.getFullYear() - n.getFullYear();
  if (auj < new Date(auj.getFullYear(), n.getMonth(), n.getDate())) a--;
  return a;
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base">{children || '—'}</dd>
    </div>
  );
}

export default function FicheEleve() {
  const { id } = useParams<{ id: string }>();
  const [eleve, setEleve] = useState<Eleve | null>(null);
  const [etat, setEtat] = useState<'chargement' | 'ok' | 'introuvable' | 'erreur'>('chargement');
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const data = await api.get<Eleve | undefined>(`/eleves/${id}`);
      if (!data) {
        setEtat('introuvable');
        return;
      }
      setEleve(data);
      setEtat('ok');
    } catch (e) {
      setEtat(e instanceof ApiError && e.status === 404 ? 'introuvable' : 'erreur');
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  function apresAjout({ rattache, saisie }: ResultatAjout) {
    const memeNom =
      normaliser(`${rattache.parent.nom} ${rattache.parent.prenom}`) ===
      normaliser(`${saisie.nom} ${saisie.prenom}`);
    setMessage(
      memeNom
        ? `${rattache.parent.prenom} ${rattache.parent.nom} a été rattaché(e) à cet élève.`
        : `Ce numéro appartenait déjà à ${rattache.parent.prenom} ${rattache.parent.nom} : le parent existant a été réutilisé. ` +
            `Si ce n'est pas la bonne personne, vérifiez le numéro de téléphone.`,
    );
    charger();
  }

  if (etat === 'chargement') return <p className="text-muted-foreground">Chargement...</p>;

  if (etat === 'introuvable') {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Élève introuvable</AlertTitle>
          <AlertDescription>
            Ce dossier n&apos;existe pas ou a été retiré.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/dashboard/eleves">Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  if (etat === 'erreur' || !eleve) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-4">
          Impossible de charger la fiche.
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEtat('chargement');
              charger();
            }}
          >
            Réessayer
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const assuranceExpiree =
    eleve.assuranceExpiration && new Date(eleve.assuranceExpiration) < new Date();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/eleves"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          ← Retour à la liste
        </Link>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">
              {eleve.nom.toUpperCase()} {eleve.prenom}
            </h1>
            <Badge variant="secondary" className="font-mono">
              {eleve.matricule}
            </Badge>
          </div>

          <Button asChild variant="outline">
            <Link href={`/dashboard/eleves/${eleve.id}/modifier`}>Modifier</Link>
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {eleve.sexe === 'F' ? 'Née' : 'Né'} le {fr(eleve.dateNaissance)} (
          {age(eleve.dateNaissance)} ans)
        </p>
      </div>

      {eleve.dossiersManquants && (
        <Alert role="status">
          <AlertTitle>Pièces manquantes au dossier</AlertTitle>
          <AlertDescription>{eleve.dossiersManquants}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert role="status">
          <AlertDescription className="flex items-start justify-between gap-4">
            {message}
            <Button size="sm" variant="ghost" onClick={() => setMessage(null)}>
              Fermer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dossier d&apos;admission</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info label="Numéro d'inscription">{eleve.numeroInscription}</Info>
              <Info label="Date d'admission">{fr(eleve.dateInscription)}</Info>
              <Info label="Taille">{eleve.taille ? `${eleve.taille} cm` : null}</Info>
              <Info label="Assurance">{eleve.assurance}</Info>
              <Info label="Fin de l'assurance">
                {eleve.assuranceExpiration && (
                  <span className="flex items-center gap-2">
                    {fr(eleve.assuranceExpiration)}
                    {assuranceExpiree && (
                      <Badge variant="destructive">Expirée</Badge>
                    )}
                  </span>
                )}
              </Info>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info label="Téléphone">{eleve.telephone}</Info>
              <Info label="Quartier">{eleve.quartier}</Info>
              <Info label="Email principal">{eleve.email1}</Info>
              <Info label="Email secondaire">{eleve.email2}</Info>
              <Info label="Profession du père">{eleve.professionPere}</Info>
              <Info label="Profession de la mère">{eleve.professionMere}</Info>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Parents et tuteurs</CardTitle>
          <AjouterParent eleveId={eleve.id} onAjoute={apresAjout} />
        </CardHeader>
        <CardContent>
          {!eleve.parents?.length ? (
            <p className="text-muted-foreground">
              Aucun parent rattaché pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {eleve.parents.map((pe) => (
                <li
                  key={pe.parentId}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {pe.parent.nom.toUpperCase()} {pe.parent.prenom}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pe.parent.telephone}
                      {pe.parent.email ? ` · ${pe.parent.email}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {LIENS[pe.lienParente] ?? pe.lienParente}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Inscriptions</CardTitle>
          <Button asChild variant="outline">
            <Link href={`/dashboard/eleves/${eleve.id}/inscrire`}>
              Inscrire dans une salle
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!eleve.inscriptions?.length ? (
            <p className="text-muted-foreground">
              Cet élève n&apos;est inscrit dans aucune classe pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Année</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Salle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Fiche</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eleve.inscriptions.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {i.anneeScolaire?.libelle ?? i.anneeScolaire?.nom ?? '—'}
                    </TableCell>
                    <TableCell>{i.niveau?.nom ?? '—'}</TableCell>
                    <TableCell>{i.salle?.nom ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          i.statut === 'validee'
                            ? 'default'
                            : i.statut === 'annulee'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {STATUTS[i.statut] ?? i.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/inscriptions/${i.id}/fiche`}
                        className="text-sm hover:text-primary hover:underline"
                      >
                        Fiche d&apos;inscription
                      </Link>

                      {i.statut === 'validee' && (
                        <Link
                          href={`/dashboard/inscriptions/${i.id}/paiements`}
                          className="ml-4 text-sm hover:text-primary hover:underline"
                        >
                          Paiements
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

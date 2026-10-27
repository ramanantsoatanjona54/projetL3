'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { messageErreur } from '@/lib/messages';
import type { AnneeBulletin, ClasseBulletins, SallePedago } from '@/lib/types';
import { ModaleCrud } from '@/components/structure/ModaleCrud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PageBulletins() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role ?? '';
  const autorise = ['ENSEIGNANT', 'ADMIN', 'DIRECTRICE'].includes(role);
  const peutPublier = role === 'ADMIN' || role === 'DIRECTRICE';
  const voitHistorique = role !== 'ENSEIGNANT';

  const [salles, setSalles] = useState<SallePedago[]>([]);
  const [annees, setAnnees] = useState<AnneeBulletin[]>([]);
  const [salleId, setSalleId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [semestre, setSemestre] = useState('1');
  const [anneeId, setAnneeId] = useState('');
  const [classe, setClasse] = useState<ClasseBulletins | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [modale, setModale] = useState(false);
  const [erreurModale, setErreurModale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const salle = salles.find((s) => String(s.id) === salleId);
  const anneeCourante = !voitHistorique || annees.find((a) => String(a.id) === anneeId)?.courante !== false;

  useEffect(() => {
    if (!autorise) return;
    api.get<SallePedago[]>('/bulletins/salles')
      .then((s) => { setSalles(s); if (s.length === 1) setSalleId(String(s[0].id)); })
      .catch((e) => setErreur(messageErreur(e)));
    if (voitHistorique) {
      api.get<AnneeBulletin[]>('/bulletins/annees')
        .then((a) => { setAnnees(a); const c = a.find((x) => x.courante); if (c) setAnneeId(String(c.id)); })
        .catch((e) => setErreur(messageErreur(e)));
    }
  }, [autorise, voitHistorique]);

  useEffect(() => {
    const s = salles.find((x) => String(x.id) === salleId);
    setNiveauId(s && s.niveaux.length === 1 ? String(s.niveaux[0].id) : '');
  }, [salleId, salles]);

  const charger = useCallback(() => {
    if (!salleId || !niveauId || (voitHistorique && !anneeId)) { setClasse(null); return; }
    const suffixe = voitHistorique ? `&anneeId=${anneeId}` : '';
    api.get<ClasseBulletins>(`/bulletins/classe?salleId=${salleId}&niveauId=${niveauId}&semestre=${semestre}${suffixe}`)
      .then((c) => { setClasse(c); setErreur(null); })
      .catch((e) => { setClasse(null); setErreur(messageErreur(e)); });
  }, [salleId, niveauId, semestre, anneeId, voitHistorique]);
  useEffect(() => { setInfo(null); charger(); }, [charger]);

  async function publierClasse() {
    setEnCours(true); setErreurModale(null);
    try {
      const r = await api.post<{ publies: number; sansAppreciation: number; parentsPrevenus: number }>('/bulletins/classe/publication', {
        salleId: Number(salleId), niveauId: Number(niveauId), semestre: Number(semestre),
      });
      setInfo(
        `${r.publies} bulletin(s) publié(s), ${r.parentsPrevenus} parent(s) prévenu(s).` +
        (r.sansAppreciation > 0 ? ` ${r.sansAppreciation} sans appréciation : non publié(s).` : ''),
      );
      setModale(false);
      charger();
    } catch (e) {
      setErreurModale(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (utilisateur && !autorise) {
    return <Alert variant="destructive" role="alert"><AlertDescription>Cette page est réservée à l&apos;équipe de l&apos;école.</AlertDescription></Alert>;
  }

  const redigees = classe?.eleves.filter((e) => e.aAppreciation).length ?? 0;
  const publies = classe?.eleves.filter((e) => e.publie).length ?? 0;

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold">Bulletins</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {role === 'ENSEIGNANT' ? "Ouvrez le bulletin d'un élève pour rédiger son appréciation." : 'Consultation, publication et impression des bulletins.'}
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {voitHistorique && (
          <div className="w-44 space-y-1.5">
            <Label htmlFor="b-annee" className="text-base">Année</Label>
            <Select value={anneeId} onValueChange={setAnneeId}>
              <SelectTrigger id="b-annee" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{annees.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.libelle}{a.courante ? ' (en cours)' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="w-44 space-y-1.5">
          <Label htmlFor="b-salle" className="text-base">Salle</Label>
          <Select value={salleId} onValueChange={setSalleId} disabled={salles.length === 1}>
            <SelectTrigger id="b-salle" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{salles.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1.5">
          <Label htmlFor="b-niveau" className="text-base">Niveau</Label>
          <Select value={niveauId} onValueChange={setNiveauId} disabled={!salle}>
            <SelectTrigger id="b-niveau" className="h-11 w-full text-base"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{salle?.niveaux.map((n) => <SelectItem key={n.id} value={String(n.id)}>{n.nom}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1.5">
          <Label htmlFor="b-sem" className="text-base">Semestre</Label>
          <Select value={semestre} onValueChange={setSemestre}>
            <SelectTrigger id="b-sem" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">Semestre 1</SelectItem><SelectItem value="2">Semestre 2</SelectItem></SelectContent>
          </Select>
        </div>
        {peutPublier && anneeCourante && classe && classe.eleves.length > 0 && (
          <Button size="lg" onClick={() => { setErreurModale(null); setModale(true); }}>Publier les bulletins complets</Button>
        )}
      </div>

      {!anneeCourante && <Alert role="status" className="mb-4"><AlertDescription>Année précédente : consultation et impression uniquement.</AlertDescription></Alert>}
      {salles.length === 0 && !erreur && <Alert role="status" className="mb-4"><AlertDescription>Aucune salle ne vous est affectée.</AlertDescription></Alert>}
      {erreur && <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{erreur}</AlertDescription></Alert>}
      <div aria-live="polite">{info && <Alert role="status" className="mb-4"><AlertDescription>{info}</AlertDescription></Alert>}</div>

      {classe && (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {classe.eleves.length} élève(s) · {redigees} appréciation(s) rédigée(s) · {publies} bulletin(s) publié(s)
          </p>
          {classe.eleves.length === 0 ? (
            <Alert role="status"><AlertDescription>Aucun élève validé dans cette classe pour cette année.</AlertDescription></Alert>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Appréciation</TableHead>
                    <TableHead>Parents</TableHead>
                    <TableHead><span className="sr-only">Action</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classe.eleves.map((e) => (
                    <TableRow key={e.inscriptionId}>
                      <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                      <TableCell>{e.aAppreciation ? <Badge variant="outline">Rédigée</Badge> : <Badge variant="secondary">À rédiger</Badge>}</TableCell>
                      <TableCell>{e.publie ? <Badge>Publié</Badge> : <Badge variant="secondary">Non publié</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/bulletins/${e.inscriptionId}/${semestre}`} className={buttonVariants({ variant: 'outline' })}>
                          Ouvrir<span className="sr-only"> le bulletin de {e.prenom} {e.nom}</span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <ModaleCrud
        ouvert={modale} titre="Publier les bulletins de la classe"
        description="Les parents verront ces bulletins et recevront une notification. Seuls ceux qui ont une appréciation sont publiés."
        libelleValider="Publier" enCours={enCours} erreur={erreurModale}
        onFermer={() => setModale(false)} onValider={publierClasse}
      >
        <p>Publier les bulletins du semestre {semestre} de la salle {classe?.salle.nom} ({Math.max(redigees - publies, 0)} à publier) ?</p>
      </ModaleCrud>
    </div>
  );
}
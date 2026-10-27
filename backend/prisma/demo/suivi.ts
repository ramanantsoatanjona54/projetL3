import { Prisma } from '@prisma/client';
import {
  Ctx, DECALAGE_MS, EleveCtx, POSTES, derniersJoursOuvres, enJour, heureLocale, pad,
} from './contexte';

const MOTIFS_JUSTIFIES = ['Maladie (certificat médical)', 'Rendez-vous médical', 'Décès dans la famille', 'Voyage en province'];
const dateFr = (iso: string): string =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

async function parLots<T>(liste: T[], taille: number, f: (lot: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < liste.length; i += taille) await f(liste.slice(i, i + taille));
}

// ---------------- Absences (30 derniers jours ouvrés) et notifications associées ----------------
export async function creerAbsences(ctx: Ctx): Promise<void> {
  const { prisma, alea } = ctx;
  const jours = derniersJoursOuvres(ctx.aujourdhui, 30).filter((j) => enJour(j).getTime() >= ctx.annee.dateDebut.getTime());
  if (jours.length === 0) { console.log("     Absences : année pas encore commencée, rien créé."); return; }

  const secretariat = ctx.agents.find((a) => a.role === 'SECRETARIAT' && a.poste === POSTES.SECRETARIAT);
  if (!secretariat) throw new Error('Compte secrétariat introuvable.');
  const saisiPar = (e: EleveCtx): number =>
    ctx.salles.find((s) => s.id === e.salleId)?.enseignantUtilisateurId ?? secretariat.utilisateurId;

  const validees = ctx.eleves.filter((e) => e.statut === 'validee');
  const vus = new Set<string>();
  const lignes: { inscriptionId: number; date: Date; justifiee: boolean; motif: string | null; saisiParId: number; jour: string; eleve: EleveCtx }[] = [];
  const ajouter = (e: EleveCtx, jour: string, justifiee: boolean, motif: string | null): boolean => {
    const cle = `${e.inscriptionId}|${jour}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    lignes.push({ inscriptionId: e.inscriptionId, date: enJour(jour), justifiee, motif, saisiParId: saisiPar(e), jour, eleve: e });
    return true;
  };

  // 1. Élèves « en alerte » : 4 absences NON justifiées sur les 15 derniers jours (seuil de 3 dépassé)
  const melange = alea.melanger(validees);
  const alertes = melange.slice(0, 4);
  for (const e of alertes) {
    let n = 0;
    for (const j of alea.melanger(jours.slice(-15))) { if (n >= 4) break; if (ajouter(e, j, false, null)) n++; }
  }
  // 2. Un élève souvent malade : 5 absences justifiées
  const malade = melange[4];
  if (malade) {
    let n = 0;
    for (const j of alea.melanger(jours)) { if (n >= 5) break; if (ajouter(malade, j, true, 'Maladie (certificat médical)')) n++; }
  }
  // 3. Absences ordinaires
  for (const e of validees) {
    for (const j of jours) {
      if (alea.proba(0.035)) {
        const justifiee = alea.proba(0.45);
        ajouter(e, j, justifiee, justifiee ? alea.choisir(MOTIFS_JUSTIFIES) : null);
      }
    }
  }

  await parLots(lignes, 500, (lot) =>
    prisma.absence.createMany({
      data: lot.map(({ inscriptionId, date, justifiee, motif, saisiParId }) => ({ inscriptionId, date, justifiee, motif, saisiParId })),
    }),
  );

  // Notifications : parents (3 derniers jours de classe) + alertes direction/secrétariat
  const recents = new Set(jours.slice(-3));
  const notifs: Prisma.NotificationCreateManyInput[] = [];
  for (const l of lignes.filter((x) => recents.has(x.jour))) {
    const famille = ctx.familles[l.eleve.familleIdx];
    for (const uid of famille.parentUtilisateurIds) {
      notifs.push({
        utilisateurId: uid,
        message: `${l.eleve.prenom} ${l.eleve.nom} a été absent(e) le ${dateFr(l.jour)}.`,
        lu: alea.proba(0.3),
        dateCreation: new Date(Math.min(heureLocale(l.jour, '09:30').getTime(), ctx.maintenant.getTime())),
      });
    }
  }
  const destAlerte = [ctx.directriceId, ...ctx.agents.filter((a) => a.role === 'SECRETARIAT' && a.actif && a.poste === POSTES.SECRETARIAT).map((a) => a.utilisateurId)];
  for (const e of alertes) {
    const n = lignes.filter((l) => l.eleve.eleveId === e.eleveId && !l.justifiee).length;
    const salle = ctx.salles.find((s) => s.id === e.salleId)?.nom ?? '';
    for (const uid of destAlerte) {
      notifs.push({
        utilisateurId: uid,
        message: `Alerte absences : ${e.prenom} ${e.nom} (salle ${salle}) totalise ${n} absences non justifiées sur 30 jours.`,
        lu: false,
        dateCreation: new Date(ctx.maintenant.getTime() - alea.entier(1, 48) * 3_600_000),
      });
    }
  }
  if (notifs.length > 0) await prisma.notification.createMany({ data: notifs });
  console.log(`     Absences : ${lignes.length} (dont ${lignes.filter((l) => !l.justifiee).length} non justifiées) · ${alertes.length} élèves en alerte · ${notifs.length} notifications`);
}

// ---------------- Pointage du personnel (10 derniers jours ouvrés) ----------------
export async function creerPointages(ctx: Ctx): Promise<void> {
  const { prisma, alea } = ctx;
  const ids = [
    ...ctx.agents.filter((a) => a.actif && !a.dateDepart).map((a) => a.personnelId),
    ...(ctx.directricePersonnelId ? [ctx.directricePersonnelId] : []),
  ];
  const jours = derniersJoursOuvres(ctx.aujourdhui, 10);
  const oubliDepart = ids[1];
  const jourOubli = jours[jours.length - 4];
  const absent = ids[2];
  const jourAbsent = jours[jours.length - 5];

  const lignes: { personnelId: number; date: Date; heureArrivee: Date; heureDepart: Date | null }[] = [];
  for (const jour of jours) {
    for (const id of ids) {
      if (id === absent && jour === jourAbsent) continue;                       // un jour d'absence
      const retard = alea.proba(0.1);
      const arrivee = heureLocale(jour, retard ? `08:${pad(alea.entier(5, 45), 2)}` : `07:${pad(alea.entier(20, 55), 2)}`);
      if (jour === ctx.aujourdhui) {
        if (arrivee > ctx.maintenant || alea.proba(0.15)) continue;             // pas encore arrivé
        lignes.push({ personnelId: id, date: enJour(jour), heureArrivee: arrivee, heureDepart: null });
        continue;
      }
      if (alea.proba(0.03)) continue;                                           // absence occasionnelle
      const depart = id === oubliDepart && jour === jourOubli ? null : heureLocale(jour, `16:${pad(alea.entier(0, 40), 2)}`);
      lignes.push({ personnelId: id, date: enJour(jour), heureArrivee: arrivee, heureDepart: depart });
    }
  }
  await parLots(lignes, 500, (lot) => prisma.pointage.createMany({ data: lot, skipDuplicates: true }));
  console.log(`     Pointages : ${lignes.length} (${ids.length} agents · ${jours.length} jours)`);
}

// ---------------- Fiches de paie (3 derniers mois) et certificats ----------------
export async function creerPaie(ctx: Ctx): Promise<void> {
  const { prisma, alea } = ctx;
  const brutPar = { ENSEIGNANT: () => alea.entier(45, 65) * 10_000, SECRETARIAT: () => alea.entier(38, 48) * 10_000, COMPTABLE: () => 700_000 };
  const cibles: { personnelId: number; brut: number }[] = [
    ...ctx.agents.filter((a) => a.actif && !a.dateDepart).map((a) => ({ personnelId: a.personnelId, brut: brutPar[a.role]() })),
    ...(ctx.directricePersonnelId ? [{ personnelId: ctx.directricePersonnelId, brut: 1_200_000 }] : []),
  ];

  const fiches: Prisma.FicheDePaieCreateManyInput[] = [];
  for (let k = 1; k <= 3; k++) {
    const d = new Date(Date.UTC(ctx.maintenant.getUTCFullYear(), ctx.maintenant.getUTCMonth() - k, 1));
    for (const c of cibles) {
      fiches.push({
        personnelId: c.personnelId, mois: d.getUTCMonth() + 1, annee: d.getUTCFullYear(),
        salaireBrut: c.brut, salaireNet: Math.round(c.brut * 0.89),
        dateGeneration: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 2, 7, 0, 0)),
      });
    }
  }
  await prisma.ficheDePaie.createMany({ data: fiches });

  const parti = ctx.agents.find((a) => a.dateDepart);
  const titulaire = ctx.agents.find((a) => a.role === 'ENSEIGNANT' && a.actif && a.salleId);
  const certificats: Prisma.CertificatTravailCreateManyInput[] = [];
  if (parti) {
    certificats.push({
      personnelId: parti.personnelId, type: 'TRAVAIL',
      contenu: `La Direction de l'école Les Colibris certifie que ${parti.prenom} ${parti.nom} a exercé les fonctions d'${parti.poste.toLowerCase()} au sein de l'établissement jusqu'au ${dateFr(parti.dateDepart!.toISOString().slice(0, 10))}. Certificat délivré pour servir et valoir ce que de droit.`,
      dateGeneration: new Date(ctx.maintenant.getTime() - 15 * 86_400_000),
    });
  }
  if (titulaire) {
    certificats.push({
      personnelId: titulaire.personnelId, type: 'CONTRAT',
      contenu: `Contrat de travail à durée indéterminée entre l'école Les Colibris et ${titulaire.prenom} ${titulaire.nom}, en qualité d'${titulaire.poste.toLowerCase()}.`,
      dateGeneration: new Date(ctx.maintenant.getTime() - 200 * 86_400_000),
    });
  }
  if (certificats.length > 0) await prisma.certificatTravail.createMany({ data: certificats });
  console.log(`     Paie : ${fiches.length} fiches · ${certificats.length} certificat(s)`);
}
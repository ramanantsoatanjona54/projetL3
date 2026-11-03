import { NiveauCompetence, Prisma } from '@prisma/client';
import { Alea, Ctx, EleveCtx, NiveauCtx, SalleCtx } from './contexte';

const APPRECIATIONS = [
  'Élève sérieux(se), qui participe volontiers. Continuez ainsi.',
  'Bon début d\'année. Quelques efforts à fournir en autonomie.',
  'Résultats encourageants, à consolider par un travail régulier à la maison.',
  'Élève agréable et curieux(se). Attention à la concentration en classe.',
  'Très bon trimestre : les acquis sont solides.',
  'Des progrès visibles. Il faut renforcer les notions encore fragiles.',
];

async function parLots<T>(liste: T[], taille: number, f: (lot: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < liste.length; i += taille) await f(liste.slice(i, i + taille));
}

function niveauAleatoire(alea: Alea, aptitude: number): NiveauCompetence {
  const pA = Math.min(0.85, Math.max(0.2, 0.5 * aptitude));
  const u = alea.suivant();
  if (u < pA) return NiveauCompetence.A;
  return u < pA + (1 - pA) * 0.6 ? NiveauCompetence.EA : NiveauCompetence.AR;
}

export async function creerPedagogie(ctx: Ctx): Promise<void> {
  const { prisma, alea, maintenant } = ctx;
  const validees = ctx.eleves.filter((e) => e.statut === 'validee');

  // niveaux réellement utilisés, avec leurs salles
  const niveaux = new Map<number, { niveau: NiveauCtx; salles: SalleCtx[] }>();
  for (const s of ctx.salles) for (const n of s.niveaux) {
    const entree = niveaux.get(n.id) ?? { niveau: n, salles: [] };
    entree.salles.push(s);
    niveaux.set(n.id, entree);
  }
  const enseignantDe = (e: EleveCtx): number => ctx.salles.find((s) => s.id === e.salleId)?.enseignantPersonnelId as number;

  let nbEvals = 0, nbProg = 0;
  const niveauxAvecContenu = new Set<number>(); // niveaux dont le bulletin a un contenu défini (seed-bulletin)
  const lignesParNiveau = new Map<number, number[]>();

  for (const { niveau, salles } of niveaux.values()) {
    const semestre1 = { semestre: { niveauId: niveau.id, numero: 1 } };

    if (niveau.cycle === 'prescolaire') {
      // ---- Classe 1 : domaines / compétences ----
      const domaines = await prisma.domaine.findMany({ where: { ceinture: semestre1 }, orderBy: { id: 'asc' }, select: { id: true } });

      const progressions: Prisma.ProgressionDomaineCreateManyInput[] = [];
      for (const s of salles) {
        domaines.forEach((d, i) => {
          const part = i / Math.max(1, domaines.length);
          if (part < 0.7 && s.enseignantPersonnelId) {
            progressions.push({
              domaineId: d.id, salleId: s.id, enseignantId: s.enseignantPersonnelId,
              statut: part < 0.4 ? 'termine' : 'en_cours', dateMaj: new Date(maintenant.getTime() - alea.entier(1, 40) * 86_400_000),
            });
          }
        });
      }
      if (progressions.length) await prisma.progressionDomaine.createMany({ data: progressions, skipDuplicates: true });
      nbProg += progressions.length;

    } else {
      // ---- Classes 2 et 3 : leçons ----
      const lecons = await prisma.lecon.findMany({
        where: { niveauId: niveau.id, ceinture: semestre1 },
        orderBy: [{ ordre: 'asc' }, { id: 'asc' }], select: { id: true },
      });
      const enseignees = lecons.slice(0, Math.min(120, Math.ceil(lecons.length * 0.6)));

      const progressions: Prisma.ProgressionLeconCreateManyInput[] = [];
      for (const s of salles) {
        if (!s.enseignantPersonnelId) continue;
        for (const l of enseignees) {
          progressions.push({
            leconId: l.id, salleId: s.id, enseignantId: s.enseignantPersonnelId,
            dateRealisation: new Date(maintenant.getTime() - alea.entier(1, 50) * 86_400_000),
          });
        }
      }
      await parLots(progressions, 2000, (lot) => prisma.progressionLecon.createMany({ data: lot, skipDuplicates: true }));
      nbProg += progressions.length;

    }

    // ---- Évaluations du bulletin (lignes définies par l'administrateur) ----
    const lignes = await prisma.elementBulletin.findMany({
      where: { type: 'LIGNE', archiveLe: null, semestre: { niveauId: niveau.id, numero: 1 } }, select: { id: true },
    });
    if (lignes.length) {
      niveauxAvecContenu.add(niveau.id);
      lignesParNiveau.set(niveau.id, lignes.map((l) => l.id));
    }
  }

  // Salle n°1 : bulletins complets (publiables) ; salle n°2 : évaluation partielle (environ 60 %)
  const rangSalle = new Map(ctx.salles.map((s, i) => [s.id, i]));
  const evaluations: Prisma.EvaluationBulletinCreateManyInput[] = [];
  for (const e of validees) {
    const ids = lignesParNiveau.get(e.niveauId);
    const r = rangSalle.get(e.salleId);
    if (!ids || (r !== 0 && r !== 1)) continue;
    const aptitude = 0.6 + alea.suivant() * 0.7;
    for (const id of ids) {
      if (r === 1 && !alea.proba(0.6)) continue;
      evaluations.push({
        inscriptionId: e.inscriptionId, elementId: id, niveau: niveauAleatoire(alea, aptitude),
        enseignantId: enseignantDe(e), dateSaisie: new Date(maintenant.getTime() - alea.entier(1, 35) * 86_400_000),
      });
    }
  }
  await parLots(evaluations, 2000, (lot) => prisma.evaluationBulletin.createMany({ data: lot, skipDuplicates: true }));
  nbEvals = evaluations.length;

  // ---- Enseignants des classes 2 et 3 : toutes les matières ----
  const matieres = await prisma.matiere.findMany({ select: { id: true } });
  const titulairesPrimaire = ctx.salles
    .filter((s) => s.enseignantPersonnelId && s.niveaux.some((n) => n.cycle !== 'prescolaire'))
    .map((s) => s.enseignantPersonnelId as number);
  await prisma.enseignantMatiere.createMany({
    data: titulairesPrimaire.flatMap((personnelId) => matieres.map((m) => ({ personnelId, matiereId: m.id }))),
    skipDuplicates: true,
  });

  // ---- Bulletins : salle n°1 publiée si son contenu est défini (donc complet), salle n°2 en brouillon ----
  const bulletins: Prisma.BulletinCreateManyInput[] = [];
  const notifs: Prisma.NotificationCreateManyInput[] = [];
  for (const e of validees) {
    const r = rangSalle.get(e.salleId);
    if (r !== 0 && r !== 1) continue;
    const publie = r === 0 && niveauxAvecContenu.has(e.niveauId);
    const datePub = new Date(maintenant.getTime() - alea.entier(1, 6) * 86_400_000);
    bulletins.push({
      inscriptionId: e.inscriptionId, periode: 'Semestre 1', appreciationGenerale: alea.choisir(APPRECIATIONS),
      publie, datePublication: publie ? datePub : null, dateGeneration: datePub,
    });
    if (publie) {
      for (const uid of ctx.familles[e.familleIdx].parentUtilisateurIds) {
        notifs.push({
          utilisateurId: uid, message: `Le bulletin du Semestre 1 de ${e.prenom} ${e.nom} est disponible.`,
          lu: alea.proba(0.4), dateCreation: datePub,
        });
      }
    }
  }
  if (bulletins.length) await prisma.bulletin.createMany({ data: bulletins, skipDuplicates: true });
  if (notifs.length) await prisma.notification.createMany({ data: notifs });

  // ---- Examens blancs (niveau 7e) : n°1 complet, n°2 partiel, n°3 futur sans notes ----
  let nbExamens = 0;
  const n7 = [...niveaux.values()].find((x) => x.niveau.nom === '7e');
  if (n7) {
    const disciplines = await prisma.matiere.findMany({ orderBy: { id: 'asc' }, take: 6, select: { id: true } });
    const coefs = [2, 2, 1, 1, 2, 1];
    const eleves7 = validees.filter((e) => e.niveauId === n7.niveau.id);
    const jourMs = 86_400_000;
    const plan = [
      { numero: 1, decalage: -28, nbDisciplines: disciplines.length },
      { numero: 2, decalage: -7, nbDisciplines: Math.min(3, disciplines.length) },
      { numero: 3, decalage: 14, nbDisciplines: 0 },
    ];
    for (const p of plan) {
      const examen = await prisma.examenBlanc.create({
        data: {
          niveauId: n7.niveau.id, anneeScolaireId: ctx.annee.id, numero: p.numero,
          date: new Date(Date.UTC(
            new Date(maintenant.getTime() + p.decalage * jourMs).getUTCFullYear(),
            new Date(maintenant.getTime() + p.decalage * jourMs).getUTCMonth(),
            new Date(maintenant.getTime() + p.decalage * jourMs).getUTCDate(),
          )),
        },
      });
      nbExamens++;
      const creees: { id: number }[] = [];
      for (let i = 0; i < disciplines.length; i++) {
        creees.push(await prisma.examenBlancDiscipline.create({
          data: { examenBlancId: examen.id, matiereId: disciplines[i].id, coefficient: coefs[i] },
        }));
      }
      const notesExamen: Prisma.NoteExamenCreateManyInput[] = [];
      for (const e of eleves7) {
        for (let i = 0; i < p.nbDisciplines; i++) {
          notesExamen.push({
            disciplineId: creees[i].id, inscriptionId: e.inscriptionId,
            note: alea.entier(24, 78) / 4, enseignantId: enseignantDe(e),
            dateSaisie: new Date(maintenant.getTime() + (p.decalage + 1) * jourMs),
          });
        }
      }
      if (notesExamen.length) await prisma.noteExamen.createMany({ data: notesExamen, skipDuplicates: true });
    }
  }

  console.log(
    `     Pédagogie : ${nbEvals} évaluations de bulletin · ${nbProg} progressions · ` +
      `${bulletins.length} bulletins · ${nbExamens} examens blancs`,
  );
}
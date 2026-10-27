import { ModePaiement, Prisma } from '@prisma/client';
import { Ctx, EleveCtx, POSTES, heureLocale, pad } from './contexte';

const TAUX_PENALITE = 0.1;
const JOUR_LIMITE = 10;
const MS_JOUR = 86_400_000;

type Scenario = 'a_jour' | 'retard_1' | 'retard_2' | 'tard' | 'annuel' | 'aucun';
const SCENARIOS: Scenario[] = [
  'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour', 'a_jour',
  'retard_1', 'retard_1', 'retard_1', 'retard_2', 'retard_2', 'tard', 'annuel', 'aucun',
];

interface Echeance { mois: number; datePrevue: Date; limite: Date }

export async function creerPaiements(ctx: Ctx): Promise<void> {
  const { prisma, alea, annee, maintenant } = ctx;

  const typeEcolage = await prisma.typeFrais.findFirst({ where: { code: 'ECOLAGE' } });
  const frais = await prisma.frais.findFirst({ where: { typeFrais: { code: 'ECOLAGE' } } });
  if (!typeEcolage || !frais) throw new Error('Barème écolage introuvable (type de frais « ECOLAGE »).');
  const remises = await prisma.remiseFraternite.findMany({ orderBy: { rang: 'asc' } });

  // Même règle que FinancesService.calculerMontantEcolage
  const montantPour = (rang: number): number => {
    if (rang <= 1) return Number(frais.montant);
    const r = remises.find((x) => x.rang === rang) ?? remises[remises.length - 1];
    return Number(r ? r.montant : frais.montant);
  };

  // Même règle que FinancesService.construireEcheances
  const echeances: Echeance[] = [];
  let y = annee.dateDebut.getUTCFullYear();
  let m = annee.dateDebut.getUTCMonth();
  while (Date.UTC(y, m, 1) <= annee.dateFin.getTime()) {
    echeances.push({
      mois: m + 1,
      datePrevue: new Date(Date.UTC(y, m, 1)),
      limite: new Date(Date.UTC(y, m, JOUR_LIMITE, 23, 59, 59)),
    });
    m++;
    if (m === 12) { m = 0; y++; }
  }
  const echus = echeances.filter((e) => e.limite < maintenant);                                   // limite dépassée
  const dus = echeances.filter((e) => e.limite >= maintenant && e.datePrevue <= maintenant);     // mois en cours

  const secretariat = ctx.agents.find((a) => a.role === 'SECRETARIAT' && a.poste === POSTES.SECRETARIAT);
  const enregistreParId = secretariat?.utilisateurId;
  const journal: Prisma.JournalAuditCreateManyInput[] = [];
  const stats: Record<string, number> = {};
  let nbPaiements = 0;

  const isoJour = (e: Echeance, jour: number) => `${e.datePrevue.toISOString().slice(0, 7)}-${pad(jour, 2)}`;
  const heureAleatoire = () => `${pad(alea.entier(8, 15), 2)}:${pad(alea.entier(0, 59), 2)}`;

  async function enregistrer(
    e: EleveCtx,
    data: { mode: ModePaiement; montant: number; penalite: number; datePrevue: Date; dateEffective: Date; mois: number | null; statut: string; motif?: string },
  ): Promise<void> {
    const p = await prisma.paiement.create({
      data: {
        inscriptionId: e.inscriptionId, anneeScolaireId: annee.id, typeFraisId: typeEcolage!.id,
        mode: data.mode, montant: data.montant, montantPenalite: data.penalite,
        datePrevue: data.datePrevue, dateEffective: data.dateEffective, moisConcerne: data.mois,
        statut: data.statut, enregistreParId, motifAnnulation: data.motif ?? null,
      },
    });
    const numeroRecu = `REC-${data.dateEffective.getUTCFullYear()}-${pad(p.id, 6)}`;
    await prisma.paiement.update({ where: { id: p.id }, data: { numeroRecu } });
    nbPaiements++;
    if (data.statut === 'paye') {
      journal.push({
        date: data.dateEffective, utilisateurId: enregistreParId, action: 'PAIEMENT_ENREGISTRE', entite: 'Paiement', entiteId: p.id,
        details: { inscriptionId: e.inscriptionId, mode: data.mode, mois: data.mois, montant: data.montant, penalite: data.penalite, numeroRecu } as Prisma.InputJsonValue,
      });
    }
  }

  async function payerMois(e: EleveCtx, montant: number, ech: Echeance, dateEffective: Date): Promise<void> {
    const jours = dateEffective > ech.limite ? Math.ceil((dateEffective.getTime() - ech.limite.getTime()) / MS_JOUR) : 0;
    const penalite = jours > 0 ? montant * TAUX_PENALITE * Math.ceil(jours / 30) : 0;
    await enregistrer(e, { mode: ModePaiement.MENSUEL, montant, penalite, datePrevue: ech.datePrevue, dateEffective, mois: ech.mois, statut: 'paye' });
  }

  const dansLesTemps = (ech: Echeance): Date => heureLocale(isoJour(ech, alea.entier(1, 9)), heureAleatoire());
  const enRetard = (ech: Echeance): Date => {
    const d = new Date(ech.limite.getTime() + alea.entier(3, 40) * MS_JOUR);
    return d < maintenant ? d : new Date(maintenant.getTime() - 3_600_000);
  };
  const moisCourant = (ech: Echeance): Date =>
    new Date(ech.datePrevue.getTime() + alea.suivant() * (Math.min(maintenant.getTime(), ech.limite.getTime()) - ech.datePrevue.getTime()));

  const validees = alea.melanger(ctx.eleves.filter((e) => e.statut === 'validee'));
  let annulationFaite = false;

  for (let i = 0; i < validees.length; i++) {
    const e = validees[i];
    const montant = montantPour(e.rang);
    let sc: Scenario = SCENARIOS[i % SCENARIOS.length];
    if (echus.length === 0 && sc !== 'annuel' && sc !== 'aucun') sc = 'a_jour';
    stats[sc] = (stats[sc] ?? 0) + 1;

    if (sc === 'aucun') continue;

    if (sc === 'annuel') {
      const debut = new Date(Math.min(annee.dateDebut.getTime() + alea.entier(0, 10) * MS_JOUR, maintenant.getTime() - 3_600_000));
      await enregistrer(e, {
        mode: ModePaiement.GLOBAL_ANNUEL, montant: montant * echeances.length, penalite: 0,
        datePrevue: annee.dateDebut, dateEffective: debut, mois: null, statut: 'paye',
      });
      continue;
    }

    let aPayer: Echeance[] = echus;
    let tardifs: Echeance[] = [];
    if (sc === 'retard_1') aPayer = echus.slice(0, -1);
    if (sc === 'retard_2') aPayer = echus.slice(0, Math.max(0, echus.length - Math.min(echus.length, alea.entier(2, 3))));
    if (sc === 'tard') tardifs = echus.slice(-2);

    for (const ech of aPayer) {
      await payerMois(e, montant, ech, tardifs.includes(ech) ? enRetard(ech) : dansLesTemps(ech));
    }
    for (const ech of tardifs) {
      if (!aPayer.includes(ech)) await payerMois(e, montant, ech, enRetard(ech));
    }

    // Mois en cours (limite pas encore dépassée) : payé à l'avance une fois sur deux
    if ((sc === 'a_jour' || sc === 'tard') && alea.proba(0.5)) {
      for (const ech of dus) await payerMois(e, montant, ech, moisCourant(ech));
    }

    // Un paiement ANNULÉ avec motif (le mois redevient dû) pour tester l'historique
    if (sc === 'retard_1' && !annulationFaite && echus.length >= 1) {
      const ech = echus[echus.length - 1];
      await enregistrer(e, {
        mode: ModePaiement.MENSUEL, montant, penalite: 0, datePrevue: ech.datePrevue,
        dateEffective: dansLesTemps(ech), mois: ech.mois, statut: 'annule', motif: 'Montant erroné : paiement saisi par erreur',
      });
      annulationFaite = true;
    }
  }

  if (journal.length > 0) await prisma.journalAudit.createMany({ data: journal });
  console.log(`     Paiements : ${nbPaiements} enregistrements · scénarios ${JSON.stringify(stats)}`);
}
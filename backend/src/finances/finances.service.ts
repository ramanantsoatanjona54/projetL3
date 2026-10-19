import { BadRequestException, ConflictException, Injectable, NotFoundException  } from '@nestjs/common';
import { ModePaiement, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { UpdateFraisDto } from './dto/update-frais.dto';
import { UpdateRemiseFraterniteDto } from './dto/update-remise-fraternite.dto';

const TAUX_PENALITE_RETARD = 0.1; // fixe, non paramétrable (confirmé)
const JOUR_LIMITE_MENSUEL = 10; // paiement attendu au plus tard le 10 du mois
const MS_JOUR = 86_400_000;

export type StatutEcheance = 'paye' | 'du' | 'en_retard' | 'a_venir';
export interface Echeance {
  mois: number; datePrevue: Date; limite: Date; montant: number;
  statut: StatutEcheance; joursRetard: number; penalite: number;
}
export interface PaiementActif { mode: ModePaiement; moisConcerne: number | null; montant: Prisma.Decimal; montantPenalite: Prisma.Decimal }

@Injectable()
export class FinancesService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= Contrôle d'accès parent =================
  // 404 (et non 403) pour ne pas révéler l'existence d'une inscription d'une autre famille.
  async verifierAccesParent(inscriptionId: number, utilisateurId: number) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId }, select: { parentId: true },
    });
    if (!utilisateur?.parentId) throw new NotFoundException('Inscription introuvable');
    const trouvee = await this.prisma.inscription.findFirst({
      where: { id: inscriptionId, eleve: { parents: { some: { parentId: utilisateur.parentId } } } },
      select: { id: true },
    });
    if (!trouvee) throw new NotFoundException('Inscription introuvable');
  }

  // ================= Barème =================
  listerFrais() {
    return this.prisma.frais.findMany({ include: { typeFrais: true } });
  }

  listerRemisesFraternite() {
    return this.prisma.remiseFraternite.findMany({ orderBy: { rang: 'asc' } });
  }

  async calculerMontantEcolage(rangEnfant: number) {
    if (rangEnfant <= 1) {
      const frais = await this.prisma.frais.findFirst({ where: { typeFrais: { code: 'ECOLAGE' } } });
      if (!frais) throw new NotFoundException('Barème écolage introuvable');
      return frais.montant;
    }
    const remise = await this.prisma.remiseFraternite.findUnique({ where: { rang: rangEnfant } });
    if (!remise) {
      // au-delà du rang maximum défini, on applique la dernière remise connue
      const derniere = await this.prisma.remiseFraternite.findFirst({ orderBy: { rang: 'desc' } });
      return derniere?.montant;
    }
    return remise.montant;
  }

  private async montantMensuelPour(rang: number): Promise<number> {
    const m = await this.calculerMontantEcolage(rang);
    if (m === undefined || m === null) throw new NotFoundException('Barème écolage introuvable');
    return Number(m);
  }

  private async typeEcolage() {
    const t = await this.prisma.typeFrais.findFirst({ where: { code: 'ECOLAGE' } });
    if (!t) throw new NotFoundException("Type de frais « ECOLAGE » introuvable");
    return t;
  }

  // ================= Échéancier (calcul pur) =================
  calculerPenaliteRetard(montantDu: number, joursDeRetard: number): number {
    if (joursDeRetard <= 0) return 0;
    return montantDu * TAUX_PENALITE_RETARD * Math.ceil(joursDeRetard / 30);
  }

  private construireEcheances(
    annee: { dateDebut: Date; dateFin: Date },
    montantMensuel: number,
    actifs: PaiementActif[],
    maintenant: Date,
  ) {
    const annuelPaye = actifs.some((p) => p.mode === ModePaiement.GLOBAL_ANNUEL);
    const moisPayes = new Set(actifs.filter((p) => p.mode === ModePaiement.MENSUEL).map((p) => p.moisConcerne));
    const echeances: Echeance[] = [];

    let y = annee.dateDebut.getUTCFullYear();
    let m = annee.dateDebut.getUTCMonth();
    while (Date.UTC(y, m, 1) <= annee.dateFin.getTime()) {
      const datePrevue = new Date(Date.UTC(y, m, 1));
      const limite = new Date(Date.UTC(y, m, JOUR_LIMITE_MENSUEL, 23, 59, 59));
      const paye = annuelPaye || moisPayes.has(m + 1);
      const enRetard = !paye && maintenant > limite;
      const joursRetard = enRetard ? Math.ceil((maintenant.getTime() - limite.getTime()) / MS_JOUR) : 0;
      const statut: StatutEcheance = paye ? 'paye' : enRetard ? 'en_retard' : maintenant >= datePrevue ? 'du' : 'a_venir';
      echeances.push({
        mois: m + 1, datePrevue, limite, montant: montantMensuel, statut, joursRetard,
        penalite: this.calculerPenaliteRetard(montantMensuel, joursRetard),
      });
      m++;
      if (m === 12) { m = 0; y++; }
    }
    return { echeances, annuelPaye };
  }

  // ================= Lecture =================
  private async chargerInscription(id: number) {
    const i = await this.prisma.inscription.findUnique({
      where: { id },
      include: {
        anneeScolaire: true,
        eleve: { select: { id: true, nom: true, prenom: true, matricule: true } },
        salle: { select: { nom: true } },
        niveau: { select: { nom: true } },
      },
    });
    if (!i) throw new NotFoundException('Inscription introuvable');
    return i;
  }

  listerPaiements(inscriptionId: number) {
    return this.prisma.paiement.findMany({
      where: { inscriptionId }, include: { typeFrais: true }, orderBy: { datePrevue: 'desc' },
    });
  }

  // Situation complète : échéancier, total payé, reste à payer, pénalités
  async situation(inscriptionId: number) {
    const inscription = await this.chargerInscription(inscriptionId);
    const typeEcolage = await this.typeEcolage();
    const montantMensuel = await this.montantMensuelPour(inscription.rangFratrie);
    const paiements = await this.prisma.paiement.findMany({
      where: { inscriptionId, typeFraisId: typeEcolage.id },
      orderBy: { dateCreation: 'desc' },
    });
    const actifs = paiements.filter((p) => p.statut === 'paye');
    const { echeances, annuelPaye } = this.construireEcheances(inscription.anneeScolaire, montantMensuel, actifs, new Date());

    const totalAnnuel = montantMensuel * echeances.length;
    const totalPaye = actifs.reduce((s, p) => s + Number(p.montant), 0);
    return {
      inscription: {
        id: inscription.id, statut: inscription.statut, rangFratrie: inscription.rangFratrie,
        eleve: inscription.eleve, salle: inscription.salle, niveau: inscription.niveau,
        anneeScolaire: { libelle: inscription.anneeScolaire.libelle },
      },
      montantMensuel, totalAnnuel, totalPaye, annuelPaye,
      penalitesEnCours: echeances.reduce((s, e) => s + e.penalite, 0),
      resteAPayer: Math.max(0, totalAnnuel - totalPaye),
      echeances, paiements,
    };
  }

  async verifierStatutPaiement(inscriptionId: number, mois: number) {
    const s = await this.situation(inscriptionId);
    const e = s.echeances.find((x) => x.mois === mois);
    if (!e) throw new BadRequestException("Ce mois ne fait pas partie de l'année scolaire.");
    return e.statut;
  }

  // ================= Encaissement =================
  async creerPaiement(dto: CreatePaiementDto, utilisateurId?: number) {
    const inscription = await this.chargerInscription(dto.inscriptionId);
    if (inscription.statut !== 'validee') {
      throw new ConflictException('Les paiements ne sont possibles que pour une inscription validée.');
    }
    const typeEcolage = await this.typeEcolage();
    const montantMensuel = await this.montantMensuelPour(inscription.rangFratrie);
    const actifs = await this.prisma.paiement.findMany({
      where: { inscriptionId: inscription.id, typeFraisId: typeEcolage.id, statut: 'paye' },
    });
    const maintenant = new Date();
    const { echeances, annuelPaye } = this.construireEcheances(inscription.anneeScolaire, montantMensuel, actifs, maintenant);
    if (annuelPaye) throw new ConflictException("L'année est déjà réglée en totalité.");

    let montant: number;
    let penalite = 0;
    let datePrevue: Date;
    let mois: number | null = null;

    if (dto.mode === ModePaiement.MENSUEL) {
      const e = echeances.find((x) => x.mois === dto.moisConcerne);
      if (!e) throw new BadRequestException("Ce mois ne fait pas partie de l'année scolaire.");
      if (e.statut === 'paye') throw new ConflictException('Ce mois est déjà payé.');
      montant = montantMensuel; penalite = e.penalite; datePrevue = e.datePrevue; mois = e.mois;
    } else {
      if (actifs.length > 0) {
        throw new ConflictException('Des mensualités sont déjà payées : réglez les mois restants un par un.');
      }
      montant = montantMensuel * echeances.length;
      datePrevue = inscription.anneeScolaire.dateDebut;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const p = await tx.paiement.create({
          data: {
            inscriptionId: inscription.id, anneeScolaireId: inscription.anneeScolaireId,
            typeFraisId: typeEcolage.id, mode: dto.mode, montant, montantPenalite: penalite,
            datePrevue, dateEffective: maintenant, moisConcerne: mois, statut: 'paye',
            enregistreParId: utilisateurId,
          },
        });
        const numeroRecu = `REC-${maintenant.getUTCFullYear()}-${String(p.id).padStart(6, '0')}`;
        const maj = await tx.paiement.update({ where: { id: p.id }, data: { numeroRecu } });
        await tx.journalAudit.create({
          data: {
            utilisateurId, action: 'PAIEMENT_ENREGISTRE', entite: 'Paiement', entiteId: p.id,
            details: { inscriptionId: inscription.id, mode: dto.mode, mois, montant, penalite, numeroRecu },
          },
        });
        return maj;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ce paiement vient d\'être enregistré par un autre utilisateur.');
      }
      throw e;
    }
  }

  async annulerPaiement(id: number, motif: string, utilisateurId?: number) {
    const p = await this.prisma.paiement.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Paiement introuvable');
    if (p.statut !== 'paye') throw new ConflictException('Seul un paiement enregistré peut être annulé.');

    const [maj] = await this.prisma.$transaction([
      this.prisma.paiement.update({ where: { id }, data: { statut: 'annule', motifAnnulation: motif } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId, action: 'PAIEMENT_ANNULE', entite: 'Paiement', entiteId: id,
          details: { motif, numeroRecu: p.numeroRecu, montant: Number(p.montant) },
        },
      }),
    ]);
    return maj;
  }

  // ================= Reçu =================
  async recu(paiementId: number) {
    const p = await this.prisma.paiement.findUnique({
      where: { id: paiementId },
      include: {
        typeFrais: true,
        inscription: {
          include: {
            eleve: { select: { id: true, nom: true, prenom: true, matricule: true } },
            salle: { select: { nom: true } },
            niveau: { select: { nom: true } },
            anneeScolaire: { select: { libelle: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Paiement introuvable');
    return p;
  }

  // ================= Retards (année scolaire en cours) =================
  async retards() {
    const maintenant = new Date();
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } },
    });
    if (!annee) return { annee: null, lignes: [] };

    const typeEcolage = await this.typeEcolage();
    const inscriptions = await this.prisma.inscription.findMany({
      where: { anneeScolaireId: annee.id, statut: 'validee' },
      include: {
        eleve: {
          select: {
            id: true, nom: true, prenom: true, matricule: true,
            parents: { include: { parent: { select: { nom: true, prenom: true, telephone: true } } } },
          },
        },
        salle: { select: { nom: true } },
        niveau: { select: { nom: true } },
        paiements: { where: { typeFraisId: typeEcolage.id, statut: 'paye' } },
      },
    });

    const cache = new Map<number, number>(); // rang -> montant (évite de requêter pour chaque élève)
    const lignes: any[] = [];
    for (const i of inscriptions) {
      if (!cache.has(i.rangFratrie)) cache.set(i.rangFratrie, await this.montantMensuelPour(i.rangFratrie));
      const montantMensuel = cache.get(i.rangFratrie)!;
      const { echeances } = this.construireEcheances(annee, montantMensuel, i.paiements, maintenant);
      const enRetard = echeances.filter((e) => e.statut === 'en_retard');
      if (enRetard.length === 0) continue;
      lignes.push({
        inscriptionId: i.id, eleve: i.eleve, salle: i.salle, niveau: i.niveau,
        moisEnRetard: enRetard.map((e) => e.mois),
        montantDu: montantMensuel * enRetard.length,
        penalites: enRetard.reduce((s, e) => s + e.penalite, 0),
        joursRetardMax: Math.max(...enRetard.map((e) => e.joursRetard)),
      });
    }
    lignes.sort((a, b) => b.montantDu + b.penalites - (a.montantDu + a.penalites));
    return { annee: { id: annee.id, libelle: annee.libelle }, lignes };
  }
  // ================= Barème : modification (admin) =================
  async modifierFrais(id: number, dto: UpdateFraisDto, utilisateurId?: number) {
    const frais = await this.prisma.frais.findUnique({ where: { id }, include: { typeFrais: true } });
    if (!frais) throw new NotFoundException(`Frais #${id} introuvable`);

    const ancien = Number(frais.montant);
    if (dto.montant === ancien) return frais; // rien à changer

    // Le tarif de base ne peut pas passer sous une remise de fratrie existante
    if (frais.typeFrais?.code === 'ECOLAGE') {
      const remises = await this.prisma.remiseFraternite.findMany();
      const plusHaute = Math.max(0, ...remises.map((r) => Number(r.montant)));
      if (dto.montant < plusHaute) {
        throw new ConflictException(
          `Le tarif de base ne peut pas être inférieur à une remise de fratrie existante (${plusHaute}). Modifiez d'abord les remises.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.frais.update({
        where: { id }, data: { montant: dto.montant, dateMaj: new Date() },
      });
      await tx.journalAudit.create({
        data: {
          utilisateurId, action: 'FRAIS_MODIFIE', entite: 'Frais', entiteId: id,
          details: { type: frais.typeFrais?.code ?? null, avant: ancien, apres: dto.montant },
        },
      });
      return maj;
    });
  }

  async modifierRemiseFraternite(id: number, dto: UpdateRemiseFraterniteDto, utilisateurId?: number) {
    const remise = await this.prisma.remiseFraternite.findUnique({ where: { id } });
    if (!remise) throw new NotFoundException(`Remise #${id} introuvable`);

    const ancien = Number(remise.montant);
    if (dto.montant === ancien) return remise;

    // Cohérence : base >= rang 2 >= rang 3 >= rang 4 ...
    const ecolage = await this.prisma.frais.findFirst({ where: { typeFrais: { code: 'ECOLAGE' } } });
    if (ecolage && dto.montant > Number(ecolage.montant)) {
      throw new ConflictException(
        `La remise du rang ${remise.rang} ne peut pas dépasser le tarif de base (${Number(ecolage.montant)}).`,
      );
    }
    const voisins = await this.prisma.remiseFraternite.findMany({
      where: { rang: { in: [remise.rang - 1, remise.rang + 1] } },
    });
    const precedent = voisins.find((v) => v.rang === remise.rang - 1);
    const suivant = voisins.find((v) => v.rang === remise.rang + 1);
    if (precedent && dto.montant > Number(precedent.montant)) {
      throw new ConflictException(
        `Le rang ${remise.rang} ne peut pas coûter plus que le rang ${precedent.rang} (${Number(precedent.montant)}).`,
      );
    }
    if (suivant && dto.montant < Number(suivant.montant)) {
      throw new ConflictException(
        `Le rang ${remise.rang} ne peut pas coûter moins que le rang ${suivant.rang} (${Number(suivant.montant)}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.remiseFraternite.update({ where: { id }, data: { montant: dto.montant } });
      await tx.journalAudit.create({
        data: {
          utilisateurId, action: 'REMISE_FRATERNITE_MODIFIEE', entite: 'RemiseFraternite', entiteId: id,
          details: { rang: remise.rang, avant: ancien, apres: dto.montant },
        },
      });
      return maj;
    });
  }

  // Combien d'inscriptions seront touchées par un changement de tarif (année en cours)
  async impactBareme() {
    const maintenant = new Date();
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } },
    });
    if (!annee) return { annee: null, inscriptionsValidees: 0 };
    const inscriptionsValidees = await this.prisma.inscription.count({
      where: { anneeScolaireId: annee.id, statut: 'validee' },
    });
    return { annee: annee.libelle, inscriptionsValidees };
  }
}
 

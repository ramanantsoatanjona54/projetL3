import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancesService } from '../finances/finances.service';

@Injectable()
export class EspaceParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finances: FinancesService,
  ) {}

  // La famille est TOUJOURS déduite du compte connecté, jamais d'un paramètre de la requête
  private async parentIdDe(utilisateurId: number): Promise<number> {
    const u = await this.prisma.utilisateur.findUnique({ where: { id: utilisateurId }, select: { parentId: true } });
    if (!u?.parentId) throw new NotFoundException('Compte parent introuvable');
    return u.parentId;
  }

  async enfants(utilisateurId: number) {
    const parentId = await this.parentIdDe(utilisateurId);
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
      select: { nom: true, prenom: true, telephone: true, email: true },
    });

    const liens = await this.prisma.parentEleve.findMany({
      where: { parentId },
      select: {
        lienParente: true,
        eleve: {
          select: {
            id: true, matricule: true, nom: true, prenom: true, sexe: true, dateNaissance: true,
            inscriptions: {
              where: { statut: { not: 'annulee' } },
              orderBy: { dateInscription: 'desc' },
              select: {
                id: true, statut: true, rangFratrie: true,
                anneeScolaire: { select: { id: true, libelle: true, dateDebut: true, dateFin: true } },
                salle: { select: { nom: true } },
                niveau: { select: { nom: true } },
              },
            },
          },
        },
      },
    });

    const maintenant = new Date();
    const enfants = await Promise.all(
      liens.map(async (lien) => {
        const e = lien.eleve;
        const inscriptions = await Promise.all(
          e.inscriptions.map(async (i) => {
            const courante = i.anneeScolaire.dateDebut <= maintenant && i.anneeScolaire.dateFin >= maintenant;
            return {
              id: i.id, statut: i.statut, rangFratrie: i.rangFratrie, courante,
              anneeScolaire: { id: i.anneeScolaire.id, libelle: i.anneeScolaire.libelle },
              salle: i.salle, niveau: i.niveau,
              resume: courante && i.statut === 'validee' ? await this.resume(i.id) : null,
            };
          }),
        );
        return {
          id: e.id, matricule: e.matricule, nom: e.nom, prenom: e.prenom, sexe: e.sexe,
          dateNaissance: e.dateNaissance, lienParente: lien.lienParente, inscriptions,
        };
      }),
    );
    enfants.sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));

    return { parent, enfants };
  }

  // Résumé financier d'une inscription de l'année en cours
  private async resume(inscriptionId: number) {
    try {
      const s = await this.finances.situation(inscriptionId);
      const exigibles = s.echeances.filter((e) => e.statut === 'du' || e.statut === 'en_retard');
      const prochaine = s.echeances.find((e) => e.statut === 'du' || e.statut === 'a_venir');
      return {
        totalAnnuel: s.totalAnnuel,
        totalPaye: s.totalPaye,
        resteAPayer: s.resteAPayer,
        exigible: exigibles.reduce((t, e) => t + e.montant, 0),
        penalitesEnCours: s.penalitesEnCours,
        moisEnRetard: s.echeances.filter((e) => e.statut === 'en_retard').map((e) => e.mois),
        prochaine: prochaine
          ? { mois: prochaine.mois, limite: prochaine.limite, montant: prochaine.montant, statut: prochaine.statut }
          : null,
      };
    } catch (e) {
      if (e instanceof NotFoundException) return null; // barème absent : on n'affiche simplement pas de résumé
      throw e;
    }
  }

  async situation(inscriptionId: number, utilisateurId: number) {
    await this.finances.verifierAccesParent(inscriptionId, utilisateurId);
    const s = await this.finances.situation(inscriptionId);
    return {
      inscription: s.inscription,
      montantMensuel: s.montantMensuel,
      totalAnnuel: s.totalAnnuel,
      totalPaye: s.totalPaye,
      annuelPaye: s.annuelPaye,
      penalitesEnCours: s.penalitesEnCours,
      resteAPayer: s.resteAPayer,
      echeances: s.echeances,
      // Seuls les paiements valides, sans aucun champ interne (agent, motif d'annulation...)
      paiements: s.paiements
        .filter((p) => p.statut === 'paye')
        .map((p) => ({
          id: p.id, mode: p.mode, moisConcerne: p.moisConcerne,
          montant: Number(p.montant), montantPenalite: Number(p.montantPenalite),
          dateEffective: p.dateEffective, numeroRecu: p.numeroRecu,
        })),
    };
  }

  async recu(paiementId: number, utilisateurId: number) {
    const r = await this.finances.recu(paiementId);
    await this.finances.verifierAccesParent(r.inscriptionId, utilisateurId);
    if (r.statut !== 'paye') throw new NotFoundException('Reçu introuvable');
    return {
      numeroRecu: r.numeroRecu,
      dateEffective: r.dateEffective,
      mode: r.mode,
      moisConcerne: r.moisConcerne,
      montant: Number(r.montant),
      montantPenalite: Number(r.montantPenalite),
      typeFrais: r.typeFrais?.code ?? null,
      eleve: r.inscription.eleve,
      salle: r.inscription.salle.nom,
      niveau: r.inscription.niveau.nom,
      anneeScolaire: r.inscription.anneeScolaire.libelle,
    };
  }
}
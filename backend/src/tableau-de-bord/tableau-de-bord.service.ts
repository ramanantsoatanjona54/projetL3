import { Injectable } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FinancesService } from '../finances/finances.service';
import { AuditService } from '../audit/audit.service';

const DECALAGE_MS = 3 * 60 * 60 * 1000; // Madagascar : UTC+3
const JOUR_MS = 86_400_000;
const jourLocalIso = () => new Date(Date.now() + DECALAGE_MS).toISOString().slice(0, 10);
const enJour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const estOuvre = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;

const { ADMIN, DIRECTRICE, SECRETARIAT, COMPTABLE } = RoleUtilisateur;

@Injectable()
export class TableauDeBordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finances: FinancesService,
    private readonly audit: AuditService,
  ) {}

  // Le contenu dépend du RÔLE DU JETON : une section non autorisée n'est jamais calculée ni envoyée
  async pour(role: RoleUtilisateur) {
    const dans = (...roles: RoleUtilisateur[]) => roles.includes(role);

    const maintenant = new Date();
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } },
      select: { id: true, libelle: true },
    });

    const [eleves, finances, personnel, comptes, activiteRecente] = await Promise.all([
      dans(ADMIN, DIRECTRICE, SECRETARIAT) ? this.voletEleves(annee?.id, role) : undefined,
      dans(DIRECTRICE, SECRETARIAT) ? this.voletFinances(role) : undefined,
      dans(ADMIN, DIRECTRICE, COMPTABLE) ? this.voletPersonnel() : undefined,
      dans(ADMIN) ? this.voletComptes() : undefined,
      dans(ADMIN, DIRECTRICE) ? this.audit.recentes(8) : undefined,
    ]);

    return { role, anneeScolaire: annee, eleves, finances, personnel, comptes, activiteRecente };
  }

  private async voletEleves(anneeId: number | undefined, role: RoleUtilisateur) {
    if (!anneeId) return { effectif: 0, enAttente: 0, parSalle: [], attente: [] };

    const [effectif, enAttente] = await Promise.all([
      this.prisma.inscription.count({ where: { anneeScolaireId: anneeId, statut: 'validee' } }),
      role === ADMIN
        ? Promise.resolve(0)
        : this.prisma.inscription.count({ where: { anneeScolaireId: anneeId, statut: 'en_attente' } }),
    ]);

    let parSalle: { salle: string; effectif: number }[] = [];
    if (role !== SECRETARIAT) {
      const groupes = await this.prisma.inscription.groupBy({
        by: ['salleId'], where: { anneeScolaireId: anneeId, statut: 'validee' }, _count: { _all: true },
      });
      const salles = await this.prisma.salle.findMany({
        where: { id: { in: groupes.map((g) => g.salleId) } }, select: { id: true, nom: true },
      });
      const nom = new Map(salles.map((s) => [s.id, s.nom]));
      parSalle = groupes
        .map((g) => ({ salle: nom.get(g.salleId) ?? `Salle ${g.salleId}`, effectif: g._count._all }))
        .sort((a, b) => a.salle.localeCompare(b.salle, 'fr', { numeric: true }));
    }

    const attente =
      role === SECRETARIAT
        ? (
            await this.prisma.inscription.findMany({
              where: { anneeScolaireId: anneeId, statut: 'en_attente' },
              orderBy: { dateInscription: 'asc' },
              take: 5,
              select: {
                id: true, dateInscription: true,
                eleve: { select: { nom: true, prenom: true } },
                salle: { select: { nom: true } },
              },
            })
          ).map((i) => ({
            id: i.id, eleve: `${i.eleve.prenom} ${i.eleve.nom}`, salle: i.salle.nom, dateInscription: i.dateInscription,
          }))
        : [];

    return { effectif, enAttente, parSalle, attente };
  }

  private async voletFinances(role: RoleUtilisateur) {
    const local = new Date(Date.now() + DECALAGE_MS);
    const debutMois = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - DECALAGE_MS);
    const debutSuivant = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - DECALAGE_MS);

    const [agg, retards] = await Promise.all([
      this.prisma.paiement.aggregate({
        where: { statut: 'paye', dateEffective: { gte: debutMois, lt: debutSuivant } },
        _sum: { montant: true, montantPenalite: true },
        _count: { _all: true },
      }),
      this.finances.retards(),
    ]);
    const lignes = retards.lignes as any[];

    const derniersPaiements =
      role === SECRETARIAT
        ? (
            await this.prisma.paiement.findMany({
              where: { statut: 'paye' },
              orderBy: { dateEffective: 'desc' },
              take: 6,
              select: {
                id: true, inscriptionId: true, numeroRecu: true, montant: true, montantPenalite: true,
                mode: true, moisConcerne: true, dateEffective: true,
                inscription: { select: { eleve: { select: { nom: true, prenom: true } } } },
              },
            })
          ).map((p) => ({
            id: p.id, inscriptionId: p.inscriptionId, numeroRecu: p.numeroRecu,
            total: Number(p.montant) + Number(p.montantPenalite),
            mode: p.mode, moisConcerne: p.moisConcerne, dateEffective: p.dateEffective,
            eleve: `${p.inscription.eleve.prenom} ${p.inscription.eleve.nom}`,
          }))
        : undefined;

    return {
      encaisseMois: Number(agg._sum.montant ?? 0) + Number(agg._sum.montantPenalite ?? 0),
      nbPaiementsMois: agg._count._all,
      retards: {
        nombre: lignes.length,
        montantDu: lignes.reduce((s, l) => s + l.montantDu, 0),
        penalites: lignes.reduce((s, l) => s + l.penalites, 0),
        plusGros: lignes.slice(0, 5).map((l) => ({
          inscriptionId: l.inscriptionId,
          eleve: `${l.eleve.prenom} ${l.eleve.nom}`,
          salle: l.salle.nom,
          montantDu: l.montantDu,
          penalites: l.penalites,
          moisEnRetard: l.moisEnRetard,
        })),
      },
      derniersPaiements,
    };
  }

  private async voletPersonnel() {
    const jour = enJour(jourLocalIso());
    const lendemain = new Date(jour.getTime() + JOUR_MS);
    const [enPoste, presentsAujourdhui] = await Promise.all([
      this.prisma.personnel.count({
        where: { dateEmbauche: { lt: lendemain }, OR: [{ dateDepart: null }, { dateDepart: { gte: jour } }] },
      }),
      this.prisma.pointage.count({ where: { date: jour, heureArrivee: { not: null } } }),
    ]);
    return { enPoste, presentsAujourdhui, jourOuvre: estOuvre(jour) };
  }

  private async voletComptes() {
    const maintenant = new Date();
    const [actifs, desactives, verrouilles, motDePasseTemporaire] = await Promise.all([
      this.prisma.utilisateur.count({ where: { actif: true } }),
      this.prisma.utilisateur.count({ where: { actif: false } }),
      this.prisma.utilisateur.count({ where: { verrouilleJusqua: { gt: maintenant } } }),
      this.prisma.utilisateur.count({ where: { actif: true, doitChangerMotDePasse: true } }),
    ]);
    return { actifs, desactives, verrouilles, motDePasseTemporaire };
  }
}
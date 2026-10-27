import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreerCreneauDto, ModifierCreneauDto } from './dto/edt.dto';

const OUVERTURE = '07:00';
const FERMETURE = '18:00';
const DUREE_MIN = 15;
const minutes = (h: string) => parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(3), 10);

interface Donnees {
  salleId: number; niveauId: number; jourSemaine: number; heureDebut: string; heureFin: string;
  matiereId: number | null; enseignantId: number | null; titre: string | null;
}
export interface Acteur { id: number }

const SELECT_CRENEAU = {
  id: true, jourSemaine: true, heureDebut: true, heureFin: true, titre: true,
  matiere: { select: { id: true, nom: true } },
  enseignant: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.EmploiDuTempsSelect;

@Injectable()
export class EmploiDuTempsService {
  constructor(private readonly prisma: PrismaService) {}

  private async anneeCourante() {
    const maintenant = new Date();
    const annee =
      (await this.prisma.anneeScolaire.findFirst({
        where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } }, select: { id: true, libelle: true },
      })) ??
      (await this.prisma.anneeScolaire.findFirst({ orderBy: { dateDebut: 'desc' }, select: { id: true, libelle: true } }));
    if (!annee) throw new BadRequestException('Aucune année scolaire configurée.');
    return annee;
  }

  // Salles avec leurs niveaux (une salle peut regrouper plusieurs niveaux)
  salles() {
    return this.prisma.salle.findMany({
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, niveaux: { orderBy: { ordre: 'asc' }, select: { id: true, nom: true } } },
    });
  }

  // ---------- Lecture personnel ----------

  async pourSalleNiveau(salleId: number, niveauId: number) {
    const annee = await this.anneeCourante();
    const salle = await this.prisma.salle.findFirst({
      where: { id: salleId, niveaux: { some: { id: niveauId } } },
      select: { id: true, nom: true, niveaux: { where: { id: niveauId }, select: { id: true, nom: true } } },
    });
    if (!salle) throw new NotFoundException("Cette salle n'accueille pas ce niveau.");

    const [creneaux, enseignants, matieres] = await Promise.all([
      this.prisma.emploiDuTemps.findMany({
        where: { salleId, niveauId, anneeScolaireId: annee.id },
        orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }], select: SELECT_CRENEAU,
      }),
      // Seul le personnel affecté à la salle peut y enseigner
      this.prisma.personnel.findMany({
        where: { salleAffecteeId: salleId, dateDepart: null },
        orderBy: { nom: 'asc' }, select: { id: true, nom: true, prenom: true },
      }),
      this.prisma.matiere.findMany({ orderBy: { nom: 'asc' }, select: { id: true, nom: true } }),
    ]);
    return {
      salle: { id: salle.id, nom: salle.nom }, niveau: salle.niveaux[0],
      annee, creneaux, enseignantsPossibles: enseignants, matieres,
    };
  }

  // ---------- Lecture parent (contrôle d'appartenance fait par le contrôleur) ----------

  async pourInscription(inscriptionId: number) {
    const ins = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      select: {
        salleId: true, niveauId: true, anneeScolaireId: true,
        eleve: { select: { prenom: true, nom: true } },
        salle: { select: { id: true, nom: true } },
        niveau: { select: { nom: true } },
      },
    });
    if (!ins) throw new NotFoundException('Emploi du temps introuvable');
    const creneaux = await this.prisma.emploiDuTemps.findMany({
      where: { salleId: ins.salleId, niveauId: ins.niveauId, anneeScolaireId: ins.anneeScolaireId },
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }], select: SELECT_CRENEAU,
    });
    return { salle: { id: ins.salle.id, nom: ins.salle.nom, niveau: ins.niveau.nom }, eleve: ins.eleve, creneaux };
  }

  // ---------- Écriture ----------

  private async verifier(d: Donnees, anneeId: number, exclureId?: number) {
    if (!(d.heureDebut < d.heureFin)) throw new BadRequestException("L'heure de fin doit suivre l'heure de début.");
    if (d.heureDebut < OUVERTURE || d.heureFin > FERMETURE) {
      throw new BadRequestException(`Les cours se placent entre ${OUVERTURE} et ${FERMETURE}.`);
    }
    if (minutes(d.heureFin) - minutes(d.heureDebut) < DUREE_MIN) {
      throw new BadRequestException(`Un créneau dure au moins ${DUREE_MIN} minutes.`);
    }
    if (!d.matiereId && !d.titre) throw new BadRequestException('Choisissez une matière ou donnez un titre (ex. Récréation).');
    if (d.matiereId && !(await this.prisma.matiere.findUnique({ where: { id: d.matiereId }, select: { id: true } }))) {
      throw new BadRequestException('Matière introuvable.');
    }
    if (d.enseignantId && !(await this.prisma.personnel.findFirst({
      where: { id: d.enseignantId, salleAffecteeId: d.salleId, dateDepart: null }, select: { id: true },
    }))) {
      throw new BadRequestException("Cet enseignant n'est pas affecté à cette salle.");
    }
    const conflit = await this.prisma.emploiDuTemps.findFirst({
      where: {
        salleId: d.salleId, niveauId: d.niveauId, anneeScolaireId: anneeId, jourSemaine: d.jourSemaine,
        id: exclureId ? { not: exclureId } : undefined,
        heureDebut: { lt: d.heureFin }, heureFin: { gt: d.heureDebut },
      },
      select: { heureDebut: true, heureFin: true, titre: true, matiere: { select: { nom: true } } },
    });
    if (conflit) {
      throw new ConflictException(
        `Ce créneau chevauche « ${conflit.matiere?.nom ?? conflit.titre ?? 'un autre créneau'} » (${conflit.heureDebut} à ${conflit.heureFin}).`,
      );
    }
  }

  private erreurUnicite(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Un créneau commence déjà à cette heure ce jour-là.');
    }
    throw e;
  }

  async creer(dto: CreerCreneauDto, acteur: Acteur) {
    const annee = await this.anneeCourante();
    const salle = await this.prisma.salle.findFirst({
      where: { id: dto.salleId, niveaux: { some: { id: dto.niveauId } } }, select: { id: true, nom: true },
    });
    if (!salle) throw new BadRequestException("Cette salle n'accueille pas ce niveau.");
    const d: Donnees = {
      salleId: salle.id, niveauId: dto.niveauId, jourSemaine: dto.jourSemaine,
      heureDebut: dto.heureDebut, heureFin: dto.heureFin,
      matiereId: dto.matiereId ?? null, enseignantId: dto.enseignantId ?? null, titre: dto.titre?.trim() || null,
    };
    await this.verifier(d, annee.id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const c = await tx.emploiDuTemps.create({ data: { ...d, anneeScolaireId: annee.id }, select: { id: true } });
        await tx.journalAudit.create({
          data: {
            utilisateurId: acteur.id, action: 'EDT_CRENEAU_CREE', entite: 'EmploiDuTemps', entiteId: c.id,
            details: { salle: salle.nom, niveauId: d.niveauId, jour: d.jourSemaine, debut: d.heureDebut, fin: d.heureFin },
          },
        });
        return c;
      });
    } catch (e) {
      this.erreurUnicite(e);
    }
  }

  async modifier(id: number, dto: ModifierCreneauDto, acteur: Acteur) {
    const ex = await this.prisma.emploiDuTemps.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Créneau introuvable');
    const d: Donnees = {
      salleId: ex.salleId, niveauId: ex.niveauId,
      jourSemaine: dto.jourSemaine ?? ex.jourSemaine,
      heureDebut: dto.heureDebut ?? ex.heureDebut,
      heureFin: dto.heureFin ?? ex.heureFin,
      // null explicite = retirer la valeur ; absent = ne pas toucher
      matiereId: dto.matiereId === undefined ? ex.matiereId : ((dto.matiereId as number | null) ?? null),
      enseignantId: dto.enseignantId === undefined ? ex.enseignantId : ((dto.enseignantId as number | null) ?? null),
      titre: dto.titre === undefined ? ex.titre : ((dto.titre as string | null)?.trim() || null),
    };
    await this.verifier(d, ex.anneeScolaireId, id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.emploiDuTemps.update({ where: { id }, data: d });
        await tx.journalAudit.create({
          data: {
            utilisateurId: acteur.id, action: 'EDT_CRENEAU_MODIFIE', entite: 'EmploiDuTemps', entiteId: id,
            details: { jour: d.jourSemaine, debut: d.heureDebut, fin: d.heureFin },
          },
        });
        return { id };
      });
    } catch (e) {
      this.erreurUnicite(e);
    }
  }

  async supprimer(id: number, acteur: Acteur) {
    const ex = await this.prisma.emploiDuTemps.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Créneau introuvable');
    await this.prisma.$transaction([
      this.prisma.emploiDuTemps.delete({ where: { id } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'EDT_CRENEAU_SUPPRIME', entite: 'EmploiDuTemps', entiteId: id,
          details: { salleId: ex.salleId, niveauId: ex.niveauId, jour: ex.jourSemaine, debut: ex.heureDebut, fin: ex.heureFin },
        },
      }),
    ]);
    return { message: 'Créneau supprimé' };
  }
}
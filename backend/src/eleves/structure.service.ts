import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClasseDto } from './dto/create-classe.dto';
import { UpdateClasseDto } from './dto/update-classe.dto';
import { CreateNiveauDto } from './dto/create-niveau.dto';
import { UpdateNiveauDto } from './dto/update-niveau.dto';
import { CreateSalleDto } from './dto/create-salle.dto';
import { UpdateSalleDto } from './dto/update-salle.dto';
import { CreateAnneeScolaireDto } from './dto/create-annee-scolaire.dto';
import { UpdateAnneeScolaireDto } from './dto/update-annee-scolaire.dto';

const jour = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class StructureService {
  constructor(private readonly prisma: PrismaService) {}

  // ================================================================
  // Année scolaire
  // ================================================================
  listerAnneesScolaires() {
    return this.prisma.anneeScolaire.findMany({ orderBy: { dateDebut: 'desc' } });
  }

  // Libellé unique (sans tenir compte de la casse) et aucune période qui en chevauche une autre
  private async verifierAnnee(libelle: string, debut: Date, fin: Date, ignorerId?: number) {
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
      throw new BadRequestException('Dates invalides.');
    }
    if (fin <= debut) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début.');
    }
    const conflit = await this.prisma.anneeScolaire.findFirst({
      where: {
        id: ignorerId ? { not: ignorerId } : undefined,
        OR: [
          { libelle: { equals: libelle, mode: 'insensitive' } },
          { dateDebut: { lte: fin }, dateFin: { gte: debut } },
        ],
      },
    });
    if (conflit) {
      throw new ConflictException(
        conflit.libelle.toLowerCase() === libelle.toLowerCase()
          ? `L'année « ${libelle} » existe déjà.`
          : `Ces dates chevauchent l'année « ${conflit.libelle} ».`,
      );
    }
  }

  async creerAnneeScolaire(dto: CreateAnneeScolaireDto, utilisateurId?: number) {
    const libelle = dto.libelle.trim();
    const debut = new Date(dto.dateDebut);
    const fin = new Date(dto.dateFin);
    await this.verifierAnnee(libelle, debut, fin);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const annee = await tx.anneeScolaire.create({ data: { libelle, dateDebut: debut, dateFin: fin } });
        await tx.journalAudit.create({
          data: {
            utilisateurId, action: 'ANNEE_CREEE', entite: 'AnneeScolaire', entiteId: annee.id,
            details: { libelle, dateDebut: jour(debut), dateFin: jour(fin) },
          },
        });
        return annee;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`L'année « ${libelle} » existe déjà.`);
      }
      throw e;
    }
  }

  async modifierAnneeScolaire(id: number, dto: UpdateAnneeScolaireDto, utilisateurId?: number) {
    const actuelle = await this.exigerAnnee(id);
    const libelle = dto.libelle?.trim() ?? actuelle.libelle;
    const debut = dto.dateDebut ? new Date(dto.dateDebut) : actuelle.dateDebut;
    const fin = dto.dateFin ? new Date(dto.dateFin) : actuelle.dateFin;

    // Les dates pilotent l'échéancier des paiements : figées dès qu'une inscription existe
    if (jour(debut) !== jour(actuelle.dateDebut) || jour(fin) !== jour(actuelle.dateFin)) {
      const inscriptions = await this.prisma.inscription.count({ where: { anneeScolaireId: id } });
      if (inscriptions > 0) {
        throw new ConflictException(
          `Les dates ne peuvent plus changer : ${inscriptions} inscription(s) et leurs échéances de paiement en dépendent. Seul le libellé est modifiable.`,
        );
      }
    }
    await this.verifierAnnee(libelle, debut, fin, id);

    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.anneeScolaire.update({
        where: { id }, data: { libelle, dateDebut: debut, dateFin: fin },
      });
      await tx.journalAudit.create({
        data: {
          utilisateurId, action: 'ANNEE_MODIFIEE', entite: 'AnneeScolaire', entiteId: id,
          details: {
            avant: { libelle: actuelle.libelle, dateDebut: jour(actuelle.dateDebut), dateFin: jour(actuelle.dateFin) },
            apres: { libelle, dateDebut: jour(debut), dateFin: jour(fin) },
          },
        },
      });
      return maj;
    });
  }

  async supprimerAnneeScolaire(id: number, utilisateurId?: number) {
    const annee = await this.exigerAnnee(id);
    const [inscriptions, salles, paiements] = await Promise.all([
      this.prisma.inscription.count({ where: { anneeScolaireId: id } }),
      this.prisma.salle.count({ where: { anneeScolaireId: id } }),
      this.prisma.paiement.count({ where: { anneeScolaireId: id } }),
    ]);
    if (inscriptions + salles + paiements > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : cette année a encore ${inscriptions} inscription(s), ${salles} salle(s) et ${paiements} paiement(s) rattaché(s).`,
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const supprimee = await tx.anneeScolaire.delete({ where: { id } });
        await tx.journalAudit.create({
          data: {
            utilisateurId, action: 'ANNEE_SUPPRIMEE', entite: 'AnneeScolaire', entiteId: id,
            details: { libelle: annee.libelle },
          },
        });
        return supprimee;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException('Impossible de supprimer : des données sont encore rattachées à cette année.');
      }
      throw e;
    }
  }

  private async exigerAnnee(id: number) {
    const annee = await this.prisma.anneeScolaire.findUnique({ where: { id } });
    if (!annee) throw new NotFoundException(`Année scolaire #${id} introuvable`);
    return annee;
  }

  // ================================================================
  // Classe
  // ================================================================
  listerClasses() {
    return this.prisma.classe.findMany({ orderBy: { ordre: 'asc' } });
  }

  async creerClasse(dto: CreateClasseDto) {
    try {
      return await this.prisma.classe.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La classe "${dto.nom}" ou l'ordre ${dto.ordre} existe déjà`);
      }
      throw e;
    }
  }

  async modifierClasse(id: number, dto: UpdateClasseDto) {
    await this.exigerClasse(id);
    try {
      return await this.prisma.classe.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La classe "${dto.nom}" ou l'ordre ${dto.ordre} existe déjà`);
      }
      throw e;
    }
  }

  async supprimerClasse(id: number) {
    await this.exigerClasse(id);
    const niveaux = await this.prisma.niveau.count({ where: { classeId: id } });
    if (niveaux > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : cette classe a encore ${niveaux} niveau(x) rattaché(s). Supprimez-les d'abord.`,
      );
    }
    return this.prisma.classe.delete({ where: { id } });
  }

  private async exigerClasse(id: number) {
    const classe = await this.prisma.classe.findUnique({ where: { id } });
    if (!classe) throw new NotFoundException(`Classe #${id} introuvable`);
    return classe;
  }

  // ================================================================
  // Niveau
  // ================================================================
  listerNiveaux() {
    return this.prisma.niveau.findMany({
      orderBy: [{ classeId: 'asc' }, { ordre: 'asc' }],
      include: { classe: true },
    });
  }

  async creerNiveau(dto: CreateNiveauDto) {
    await this.exigerClasse(dto.classeId);
    try {
      return await this.prisma.niveau.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Le niveau "${dto.nom}" existe déjà pour cette classe`);
      }
      throw e;
    }
  }

  async modifierNiveau(id: number, dto: UpdateNiveauDto) {
    await this.exigerNiveau(id);
    if (dto.classeId) await this.exigerClasse(dto.classeId);
    try {
      return await this.prisma.niveau.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Le niveau "${dto.nom}" existe déjà pour cette classe`);
      }
      throw e;
    }
  }

  async supprimerNiveau(id: number) {
    await this.exigerNiveau(id);
    const [inscriptions, semestres, lecons, examensBlancs, matiereCoefficients, emploisDuTemps] =
      await Promise.all([
        this.prisma.inscription.count({ where: { niveauId: id } }),
        this.prisma.semestre.count({ where: { niveauId: id } }),
        this.prisma.lecon.count({ where: { niveauId: id } }),
        this.prisma.examenBlanc.count({ where: { niveauId: id } }),
        this.prisma.matiereCoefficient.count({ where: { niveauId: id } }),
        this.prisma.emploiDuTemps.count({ where: { niveauId: id } }),
      ]);
    const total = inscriptions + semestres + lecons + examensBlancs + matiereCoefficients + emploisDuTemps;
    if (total > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ce niveau a encore des données rattachées ` +
          `(${inscriptions} inscription(s), ${semestres} semestre(s), ${lecons} leçon(s), ` +
          `${examensBlancs} examen(s) blanc(s), ${matiereCoefficients} coefficient(s), ${emploisDuTemps} créneau(x) d'emploi du temps).`,
      );
    }
    return this.prisma.niveau.delete({ where: { id } });
  }

  private async exigerNiveau(id: number) {
    const niveau = await this.prisma.niveau.findUnique({ where: { id } });
    if (!niveau) throw new NotFoundException(`Niveau #${id} introuvable`);
    return niveau;
  }

  // ================================================================
  // Salle
  // ================================================================
  listerSalles() {
    return this.prisma.salle.findMany({
      orderBy: { nom: 'asc' },
      include: { niveaux: { select: { id: true, nom: true } } },
    });
  }

  async creerSalle(dto: CreateSalleDto) {
    if (dto.niveauIds?.length) await this.exigerNiveaux(dto.niveauIds);
    try {
      return await this.prisma.salle.create({
        data: {
          nom: dto.nom,
          anneeScolaireId: dto.anneeScolaireId,
          niveaux: dto.niveauIds ? { connect: dto.niveauIds.map((id) => ({ id })) } : undefined,
        },
        include: { niveaux: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La salle "${dto.nom}" existe déjà`);
      }
      throw e;
    }
  }

  async modifierSalle(id: number, dto: UpdateSalleDto) {
    await this.exigerSalle(id);
    if (dto.niveauIds?.length) await this.exigerNiveaux(dto.niveauIds);
    try {
      return await this.prisma.salle.update({
        where: { id },
        data: {
          nom: dto.nom,
          anneeScolaireId: dto.anneeScolaireId,
          // "set" remplace entierement la liste des niveaux lies, plutot que d'ajouter
          niveaux: dto.niveauIds ? { set: dto.niveauIds.map((nid) => ({ id: nid })) } : undefined,
        },
        include: { niveaux: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La salle "${dto.nom}" existe déjà`);
      }
      throw e;
    }
  }

  async supprimerSalle(id: number) {
    await this.exigerSalle(id);
    const [inscriptions, emploisDuTemps, progressionsLecon, progressionsDomaine] = await Promise.all([
      this.prisma.inscription.count({ where: { salleId: id } }),
      this.prisma.emploiDuTemps.count({ where: { salleId: id } }),
      this.prisma.progressionLecon.count({ where: { salleId: id } }),
      this.prisma.progressionDomaine.count({ where: { salleId: id } }),
    ]);
    const total = inscriptions + emploisDuTemps + progressionsLecon + progressionsDomaine;
    if (total > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : cette salle a encore des données rattachées ` +
          `(${inscriptions} inscription(s), ${emploisDuTemps} créneau(x), ${progressionsLecon + progressionsDomaine} progression(s)).`,
      );
    }
    // Le lien vers les niveaux (table de jonction implicite _NiveauToSalle) est
    // automatiquement nettoye par Prisma/PostgreSQL (FK en cascade sur cette table).
    return this.prisma.salle.delete({ where: { id } });
  }

  private async exigerSalle(id: number) {
    const salle = await this.prisma.salle.findUnique({ where: { id } });
    if (!salle) throw new NotFoundException(`Salle #${id} introuvable`);
    return salle;
  }

  private async exigerNiveaux(ids: number[]) {
    const count = await this.prisma.niveau.count({ where: { id: { in: ids } } });
    if (count !== ids.length) {
      throw new NotFoundException('Un ou plusieurs niveaux indiqués sont introuvables');
    }
  }
}
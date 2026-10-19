import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDomaineDto } from './dto/create-domaine.dto';
import { CreateSousDomaineDto } from './dto/create-sous-domaine.dto';
import { CreateCompetenceDto } from './dto/create-competence.dto';
import { CreateLeconDto } from './dto/create-lecon.dto';
import { UpdateLeconDto } from './dto/update-lecon.dto';
import { CreateMatiereDto } from './dto/create-matiere.dto';
import { UpdateMatiereDto } from './dto/update-matiere.dto';
import { CreateRubriqueDto } from './dto/create-rubrique.dto';
import { UpdateRubriqueDto } from './dto/update-rubrique.dto';
import { ProgressionDomaineDto } from './dto/progression-domaine.dto';
import { ProgressionLeconDto } from './dto/progression-lecon.dto';

@Injectable()
export class ReferentielService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------
  // Lecture de la structure Niveau -> Semestre -> Ceinture
  // ---------------------------------------------------------------
  async getSemestresParNiveau(niveauId: number) {
    const niveau = await this.prisma.niveau.findUnique({
      where: { id: niveauId },
      include: { classe: true },
    });
    if (!niveau) throw new NotFoundException('Niveau introuvable');

    return this.prisma.semestre.findMany({
      where: { niveauId },
      orderBy: { numero: 'asc' },
      include: {
        ceintures: { orderBy: { ordre: 'asc' } },
      },
    });
  }

  // ---------------------------------------------------------------
  // Classe 1 : Domaine / SousDomaine / Competence
  // ---------------------------------------------------------------
  async getDomainesParCeinture(ceintureId: number) {
    return this.prisma.domaine.findMany({
      where: { ceintureId },
      include: {
        sousDomaines: { include: { competences: true } },
        competences: { where: { sousDomaineId: null } },
      },
    });
  }

  async createDomaine(dto: CreateDomaineDto) {
    return this.prisma.domaine.create({ data: dto });
  }

  async createSousDomaine(dto: CreateSousDomaineDto) {
    const domaine = await this.prisma.domaine.findUnique({ where: { id: dto.domaineId } });
    if (!domaine) throw new NotFoundException('Domaine introuvable');
    return this.prisma.sousDomaine.create({ data: dto });
  }

  async createCompetence(dto: CreateCompetenceDto) {
    if (!dto.domaineId && !dto.sousDomaineId) {
      throw new NotFoundException('domaineId ou sousDomaineId requis');
    }
    return this.prisma.competence.create({ data: dto });
  }

  // ---------------------------------------------------------------
  // Classe 2/3/college : Matiere (CRUD)
  // ---------------------------------------------------------------
  async listerMatieres() {
    return this.prisma.matiere.findMany({
      orderBy: { nom: 'asc' },
      include: { rubriques: { orderBy: { nom: 'asc' } } },
    });
  }

  async creerMatiere(dto: CreateMatiereDto) {
    try {
      return await this.prisma.matiere.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La matière "${dto.nom}" existe déjà`);
      }
      throw e;
    }
  }

  async modifierMatiere(id: number, dto: UpdateMatiereDto) {
    await this.exigerMatiere(id);
    try {
      return await this.prisma.matiere.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La matière "${dto.nom}" existe déjà`);
      }
      throw e;
    }
  }

  async supprimerMatiere(id: number) {
    await this.exigerMatiere(id);
    const [rubriques, lecons] = await Promise.all([
      this.prisma.rubrique.count({ where: { matiereId: id } }),
      this.prisma.lecon.count({ where: { matiereId: id } }),
    ]);
    if (rubriques > 0 || lecons > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : cette matière a encore ${rubriques} rubrique(s) et ${lecons} leçon(s) rattachées. Supprimez-les d'abord.`,
      );
    }
    return this.prisma.matiere.delete({ where: { id } });
  }

  private async exigerMatiere(id: number) {
    const matiere = await this.prisma.matiere.findUnique({ where: { id } });
    if (!matiere) throw new NotFoundException(`Matière #${id} introuvable`);
    return matiere;
  }

  // ---------------------------------------------------------------
  // Classe 2/3/college : Rubrique (CRUD)
  // ---------------------------------------------------------------
  async listerRubriques(matiereId: number) {
    await this.exigerMatiere(matiereId);
    return this.prisma.rubrique.findMany({ where: { matiereId }, orderBy: { nom: 'asc' } });
  }

  async creerRubrique(dto: CreateRubriqueDto) {
    await this.exigerMatiere(dto.matiereId);
    try {
      return await this.prisma.rubrique.create({ data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La rubrique "${dto.nom}" existe déjà pour cette matière`);
      }
      throw e;
    }
  }

  async modifierRubrique(id: number, dto: UpdateRubriqueDto) {
    await this.exigerRubrique(id);
    try {
      return await this.prisma.rubrique.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`La rubrique "${dto.nom}" existe déjà pour cette matière`);
      }
      throw e;
    }
  }

  async supprimerRubrique(id: number) {
    await this.exigerRubrique(id);
    const lecons = await this.prisma.lecon.count({ where: { rubriqueId: id } });
    if (lecons > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : cette rubrique a encore ${lecons} leçon(s) rattachée(s). Supprimez-les d'abord ou détachez-les.`,
      );
    }
    return this.prisma.rubrique.delete({ where: { id } });
  }

  private async exigerRubrique(id: number) {
    const rubrique = await this.prisma.rubrique.findUnique({ where: { id } });
    if (!rubrique) throw new NotFoundException(`Rubrique #${id} introuvable`);
    return rubrique;
  }

  // ---------------------------------------------------------------
  // Classe 2/3/college : Lecon (CRUD)
  // ---------------------------------------------------------------
  async getLeconsParCeinture(ceintureId: number) {
    const lecons = await this.prisma.lecon.findMany({
      where: { ceintureId },
      include: { matiere: true, rubrique: true },
      orderBy: [{ matiereId: 'asc' }, { ordre: 'asc' }],
    });

    // regroupe par matiere puis par rubrique (null = pas de sous-categorie, ex: Calcul)
    const parMatiere = new Map<number, { matiere: string; rubriques: Map<string, any[]> }>();
    for (const l of lecons) {
      if (!parMatiere.has(l.matiereId)) {
        parMatiere.set(l.matiereId, { matiere: l.matiere.nom, rubriques: new Map() });
      }
      const groupe = parMatiere.get(l.matiereId)!;
      const cleRubrique = l.rubrique?.nom ?? '__sans_rubrique__';
      if (!groupe.rubriques.has(cleRubrique)) {
        groupe.rubriques.set(cleRubrique, []);
      }
      groupe.rubriques.get(cleRubrique)!.push(l);
    }

    return Array.from(parMatiere.values()).map((g) => ({
      matiere: g.matiere,
      rubriques: Array.from(g.rubriques.entries()).map(([nom, items]) => ({
        nom: nom === '__sans_rubrique__' ? null : nom,
        lecons: items,
      })),
    }));
  }

  async createLecon(dto: CreateLeconDto) {
    await this.exigerMatiere(dto.matiereId);
    if (dto.rubriqueId) {
      const rubrique = await this.prisma.rubrique.findUnique({ where: { id: dto.rubriqueId } });
      if (!rubrique) throw new NotFoundException(`Rubrique #${dto.rubriqueId} introuvable`);
      if (rubrique.matiereId !== dto.matiereId) {
        throw new BadRequestException('Cette rubrique n\'appartient pas à la matière indiquée');
      }
    }
    return this.prisma.lecon.create({ data: dto });
  }

  async modifierLecon(id: number, dto: UpdateLeconDto) {
    await this.exigerLecon(id);
    return this.prisma.lecon.update({ where: { id }, data: dto });
  }

  async supprimerLecon(id: number) {
    await this.exigerLecon(id);
    const [progressions, notes] = await Promise.all([
      this.prisma.progressionLecon.count({ where: { leconId: id } }),
      this.prisma.noteLecon.count({ where: { leconId: id } }),
    ]);
    if (progressions > 0 || notes > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : cette leçon a déjà ${progressions} progression(s) et ${notes} note(s) d'élève enregistrées.`,
      );
    }
    return this.prisma.lecon.delete({ where: { id } });
  }

  private async exigerLecon(id: number) {
    const lecon = await this.prisma.lecon.findUnique({ where: { id } });
    if (!lecon) throw new NotFoundException(`Leçon #${id} introuvable`);
    return lecon;
  }

  // ---------------------------------------------------------------
  // Suivi de progression par salle
  // ---------------------------------------------------------------
  async marquerDomaine(dto: ProgressionDomaineDto, enseignantId: number) {
    return this.prisma.progressionDomaine.upsert({
      where: { domaineId_salleId: { domaineId: dto.domaineId, salleId: dto.salleId } },
      update: { statut: dto.statut ?? 'en_cours', enseignantId, dateMaj: new Date() },
      create: {
        domaineId: dto.domaineId,
        salleId: dto.salleId,
        enseignantId,
        statut: dto.statut ?? 'en_cours',
      },
    });
  }

  async marquerLecon(dto: ProgressionLeconDto, enseignantId: number) {
    return this.prisma.progressionLecon.upsert({
      where: { leconId_salleId: { leconId: dto.leconId, salleId: dto.salleId } },
      update: { enseignantId, dateRealisation: new Date() },
      create: { leconId: dto.leconId, salleId: dto.salleId, enseignantId },
    });
  }

  async getProgressionSalle(salleId: number) {
    const [domaines, lecons] = await Promise.all([
      this.prisma.progressionDomaine.findMany({
        where: { salleId },
        include: { domaine: true },
      }),
      this.prisma.progressionLecon.findMany({
        where: { salleId },
        include: { lecon: { include: { matiere: true, rubrique: true } } },
      }),
    ]);
    return { domaines, lecons };
  }
}
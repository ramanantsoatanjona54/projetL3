import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreerCompetenceDto, CreerDomaineDto, CreerLeconDto, CreerRubriqueDto, CreerSousDomaineDto,
  LibelleDto, ModifierLeconDto, NomDto,
} from './dto/programmes.dto';

const nettoyer = (s: string) => s.trim().replace(/\s+/g, ' ');
const insensible = (v: string) => ({ equals: v, mode: 'insensitive' as const });

function exiger(texte: string, champ: string): string {
  const t = nettoyer(texte);
  if (!t) throw new BadRequestException(`${champ} ne peut pas être vide.`);
  return t;
}

const COMPETENCE_SELECT = { id: true, libelle: true, _count: { select: { notes: true } } } satisfies Prisma.CompetenceSelect;

@Injectable()
export class ProgrammesService {
  constructor(private readonly prisma: PrismaService) {}

  // L'index unique de la base est le dernier rempart contre les doublons (deux clics simultanés)
  private async protege<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Cet élément existe déjà.');
      throw e;
    }
  }

  // ---------- Lecture ----------

  niveaux(): Promise<unknown> {
    return this.prisma.niveau.findMany({
      orderBy: [{ classe: { ordre: 'asc' } }, { ordre: 'asc' }],
      select: { id: true, nom: true, classe: { select: { nom: true, cycle: true } } },
    });
  }

  matieres(): Promise<unknown> {
    return this.prisma.matiere.findMany({
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, rubriques: { orderBy: { nom: 'asc' }, select: { id: true, nom: true, _count: { select: { lecons: true } } } } },
    });
  }

  // Programme complet d'un niveau : domaines et compétences (prescolaire) ou leçons (autres cycles)
  async arbre(niveauId: number): Promise<unknown> {
    const niveau = await this.prisma.niveau.findUnique({
      where: { id: niveauId },
      select: { id: true, nom: true, classe: { select: { nom: true, cycle: true } } },
    });
    if (!niveau) throw new NotFoundException('Niveau introuvable.');

    const semestres = await this.prisma.semestre.findMany({
      where: { niveauId },
      orderBy: { numero: 'asc' },
      select: {
        id: true, numero: true,
        ceintures: {
          orderBy: { ordre: 'asc' },
          select: {
            id: true, nom: true,
            domaines: {
              orderBy: { id: 'asc' },
              select: {
                id: true, nom: true, _count: { select: { progressions: true } },
                competences: { orderBy: { id: 'asc' }, select: COMPETENCE_SELECT },
                sousDomaines: { orderBy: { id: 'asc' }, select: { id: true, nom: true, competences: { orderBy: { id: 'asc' }, select: COMPETENCE_SELECT } } },
              },
            },
            lecons: {
              where: { niveauId },
              orderBy: [{ matiereId: 'asc' }, { rubriqueId: 'asc' }, { ordre: 'asc' }, { id: 'asc' }],
              select: {
                id: true, titre: true, ordre: true,
                matiere: { select: { id: true, nom: true } }, rubrique: { select: { id: true, nom: true } },
                _count: { select: { notes: true, progressions: true } },
              },
            },
          },
        },
      },
    });
    return { niveau, type: niveau.classe.cycle === 'prescolaire' ? 'domaines' : 'lecons', semestres };
  }

  // ---------- Domaines ----------

  async creerDomaine(dto: CreerDomaineDto): Promise<unknown> {
    const nom = exiger(dto.nom, 'Le nom');
    if (!(await this.prisma.ceinture.findUnique({ where: { id: dto.ceintureId }, select: { id: true } }))) throw new NotFoundException('Ceinture introuvable.');
    if (await this.prisma.domaine.findFirst({ where: { ceintureId: dto.ceintureId, nom: insensible(nom) }, select: { id: true } })) {
      throw new ConflictException(`Le domaine « ${nom} » existe déjà dans cette ceinture.`);
    }
    return this.protege(() => this.prisma.domaine.create({ data: { ceintureId: dto.ceintureId, nom }, select: { id: true, nom: true } }));
  }

  async modifierDomaine(id: number, dto: NomDto): Promise<unknown> {
    const d = await this.prisma.domaine.findUnique({ where: { id }, select: { ceintureId: true } });
    if (!d) throw new NotFoundException('Domaine introuvable.');
    const nom = exiger(dto.nom, 'Le nom');
    if (await this.prisma.domaine.findFirst({ where: { ceintureId: d.ceintureId, nom: insensible(nom), id: { not: id } }, select: { id: true } })) {
      throw new ConflictException(`Le domaine « ${nom} » existe déjà dans cette ceinture.`);
    }
    return this.protege(() => this.prisma.domaine.update({ where: { id }, data: { nom }, select: { id: true, nom: true } }));
  }

  async supprimerDomaine(id: number): Promise<{ message: string }> {
    const d = await this.prisma.domaine.findUnique({
      where: { id }, select: { nom: true, _count: { select: { sousDomaines: true, competences: true, progressions: true } } },
    });
    if (!d) throw new NotFoundException('Domaine introuvable.');
    const { sousDomaines, competences, progressions } = d._count;
    if (sousDomaines + competences + progressions > 0) {
      throw new ConflictException(`Le domaine « ${d.nom} » n'est pas vide (${sousDomaines} sous-domaine(s), ${competences} compétence(s), ${progressions} suivi(s) de progression). Videz-le d'abord.`);
    }
    await this.prisma.domaine.delete({ where: { id } });
    return { message: 'Domaine supprimé.' };
  }

  // ---------- Sous-domaines ----------

  async creerSousDomaine(dto: CreerSousDomaineDto): Promise<unknown> {
    const nom = exiger(dto.nom, 'Le nom');
    if (!(await this.prisma.domaine.findUnique({ where: { id: dto.domaineId }, select: { id: true } }))) throw new NotFoundException('Domaine introuvable.');
    if (await this.prisma.sousDomaine.findFirst({ where: { domaineId: dto.domaineId, nom: insensible(nom) }, select: { id: true } })) {
      throw new ConflictException(`Le sous-domaine « ${nom} » existe déjà dans ce domaine.`);
    }
    return this.protege(() => this.prisma.sousDomaine.create({ data: { domaineId: dto.domaineId, nom }, select: { id: true, nom: true } }));
  }

  async modifierSousDomaine(id: number, dto: NomDto): Promise<unknown> {
    const s = await this.prisma.sousDomaine.findUnique({ where: { id }, select: { domaineId: true } });
    if (!s) throw new NotFoundException('Sous-domaine introuvable.');
    const nom = exiger(dto.nom, 'Le nom');
    if (await this.prisma.sousDomaine.findFirst({ where: { domaineId: s.domaineId, nom: insensible(nom), id: { not: id } }, select: { id: true } })) {
      throw new ConflictException(`Le sous-domaine « ${nom} » existe déjà dans ce domaine.`);
    }
    return this.protege(() => this.prisma.sousDomaine.update({ where: { id }, data: { nom }, select: { id: true, nom: true } }));
  }

  async supprimerSousDomaine(id: number): Promise<{ message: string }> {
    const s = await this.prisma.sousDomaine.findUnique({ where: { id }, select: { nom: true, _count: { select: { competences: true } } } });
    if (!s) throw new NotFoundException('Sous-domaine introuvable.');
    if (s._count.competences > 0) throw new ConflictException(`Le sous-domaine « ${s.nom} » contient ${s._count.competences} compétence(s). Videz-le d'abord.`);
    await this.prisma.sousDomaine.delete({ where: { id } });
    return { message: 'Sous-domaine supprimé.' };
  }

  // ---------- Compétences ----------

  async creerCompetence(dto: CreerCompetenceDto): Promise<unknown> {
    if ((dto.domaineId == null) === (dto.sousDomaineId == null)) throw new BadRequestException('Indiquez un domaine ou un sous-domaine, pas les deux.');
    const libelle = exiger(dto.libelle, 'Le libellé');
    if (dto.domaineId != null) {
      if (!(await this.prisma.domaine.findUnique({ where: { id: dto.domaineId }, select: { id: true } }))) throw new NotFoundException('Domaine introuvable.');
    } else if (!(await this.prisma.sousDomaine.findUnique({ where: { id: dto.sousDomaineId! }, select: { id: true } }))) {
      throw new NotFoundException('Sous-domaine introuvable.');
    }
    const parent = dto.domaineId != null ? { domaineId: dto.domaineId } : { sousDomaineId: dto.sousDomaineId };
    if (await this.prisma.competence.findFirst({ where: { ...parent, libelle: insensible(libelle) }, select: { id: true } })) {
      throw new ConflictException('Cette compétence existe déjà à cet endroit.');
    }
    return this.protege(() => this.prisma.competence.create({ data: { ...parent, libelle }, select: { id: true, libelle: true } }));
  }

  async modifierCompetence(acteurId: number, id: number, dto: LibelleDto): Promise<unknown> {
    const c = await this.prisma.competence.findUnique({
      where: { id }, select: { domaineId: true, sousDomaineId: true, libelle: true, _count: { select: { notes: true } } },
    });
    if (!c) throw new NotFoundException('Compétence introuvable.');
    const libelle = exiger(dto.libelle, 'Le libellé');
    const parent = c.domaineId != null ? { domaineId: c.domaineId } : { sousDomaineId: c.sousDomaineId };
    if (await this.prisma.competence.findFirst({ where: { ...parent, libelle: insensible(libelle), id: { not: id } }, select: { id: true } })) {
      throw new ConflictException('Cette compétence existe déjà à cet endroit.');
    }
    const maj = await this.protege(() => this.prisma.competence.update({ where: { id }, data: { libelle }, select: { id: true, libelle: true } }));
    if (c._count.notes > 0 && c.libelle !== libelle) {
      await this.prisma.journalAudit.create({
        data: { utilisateurId: acteurId, action: 'COMPETENCE_EVALUEE_TEXTE_MODIFIE', entite: 'Competence', entiteId: id, details: { avant: c.libelle, apres: libelle, evaluations: c._count.notes } },
      });
    }
    return maj;
  }

  async supprimerCompetence(id: number): Promise<{ message: string }> {
    const c = await this.prisma.competence.findUnique({ where: { id }, select: { _count: { select: { notes: true } } } });
    if (!c) throw new NotFoundException('Compétence introuvable.');
    if (c._count.notes > 0) {
      throw new ConflictException(`Cette compétence est déjà évaluée pour ${c._count.notes} élève(s) : elle ne peut pas être supprimée. Vous pouvez corriger son texte.`);
    }
    await this.prisma.competence.delete({ where: { id } });
    return { message: 'Compétence supprimée.' };
  }

  // ---------- Rubriques ----------

  async creerRubrique(dto: CreerRubriqueDto): Promise<unknown> {
    const nom = exiger(dto.nom, 'Le nom');
    if (!(await this.prisma.matiere.findUnique({ where: { id: dto.matiereId }, select: { id: true } }))) throw new NotFoundException('Matière introuvable.');
    if (await this.prisma.rubrique.findFirst({ where: { matiereId: dto.matiereId, nom: insensible(nom) }, select: { id: true } })) {
      throw new ConflictException(`La rubrique « ${nom} » existe déjà dans cette matière.`);
    }
    return this.protege(() => this.prisma.rubrique.create({ data: { matiereId: dto.matiereId, nom }, select: { id: true, nom: true } }));
  }

  async modifierRubrique(id: number, dto: NomDto): Promise<unknown> {
    const r = await this.prisma.rubrique.findUnique({ where: { id }, select: { matiereId: true } });
    if (!r) throw new NotFoundException('Rubrique introuvable.');
    const nom = exiger(dto.nom, 'Le nom');
    if (await this.prisma.rubrique.findFirst({ where: { matiereId: r.matiereId, nom: insensible(nom), id: { not: id } }, select: { id: true } })) {
      throw new ConflictException(`La rubrique « ${nom} » existe déjà dans cette matière.`);
    }
    return this.protege(() => this.prisma.rubrique.update({ where: { id }, data: { nom }, select: { id: true, nom: true } }));
  }

  async supprimerRubrique(id: number): Promise<{ message: string }> {
    const r = await this.prisma.rubrique.findUnique({ where: { id }, select: { nom: true, _count: { select: { lecons: true } } } });
    if (!r) throw new NotFoundException('Rubrique introuvable.');
    if (r._count.lecons > 0) throw new ConflictException(`La rubrique « ${r.nom} » contient ${r._count.lecons} leçon(s). Déplacez-les ou supprimez-les d'abord.`);
    await this.prisma.rubrique.delete({ where: { id } });
    return { message: 'Rubrique supprimée.' };
  }

  // ---------- Leçons ----------

  async creerLecon(dto: CreerLeconDto): Promise<unknown> {
    const titre = exiger(dto.titre, 'Le titre');
    const ceinture = await this.prisma.ceinture.findUnique({ where: { id: dto.ceintureId }, select: { semestre: { select: { niveauId: true } } } });
    if (!ceinture) throw new NotFoundException('Ceinture introuvable.');
    if (ceinture.semestre.niveauId !== dto.niveauId) throw new BadRequestException("Cette ceinture n'appartient pas à ce niveau.");
    if (!(await this.prisma.matiere.findUnique({ where: { id: dto.matiereId }, select: { id: true } }))) throw new NotFoundException('Matière introuvable.');
    if (dto.rubriqueId != null) {
      const r = await this.prisma.rubrique.findUnique({ where: { id: dto.rubriqueId }, select: { matiereId: true } });
      if (!r || r.matiereId !== dto.matiereId) throw new BadRequestException("Cette rubrique n'appartient pas à cette matière.");
    }
    const groupe = { niveauId: dto.niveauId, ceintureId: dto.ceintureId, matiereId: dto.matiereId, rubriqueId: dto.rubriqueId ?? null };
    if (await this.prisma.lecon.findFirst({ where: { ...groupe, titre: insensible(titre) }, select: { id: true } })) {
      throw new ConflictException('Cette leçon existe déjà dans cette matière, cette rubrique et cette ceinture.');
    }
    const ordre = dto.ordre ?? ((await this.prisma.lecon.aggregate({ where: groupe, _max: { ordre: true } }))._max.ordre ?? 0) + 1;
    return this.protege(() => this.prisma.lecon.create({ data: { ...groupe, titre, ordre }, select: { id: true, titre: true, ordre: true } }));
  }

  async modifierLecon(acteurId: number, id: number, dto: ModifierLeconDto): Promise<unknown> {
    const l = await this.prisma.lecon.findUnique({
      where: { id },
      select: { titre: true, niveauId: true, ceintureId: true, matiereId: true, rubriqueId: true, _count: { select: { notes: true } } },
    });
    if (!l) throw new NotFoundException('Leçon introuvable.');
    const titre = dto.titre !== undefined ? exiger(dto.titre, 'Le titre') : undefined;
    if (titre !== undefined && (await this.prisma.lecon.findFirst({
      where: { niveauId: l.niveauId, ceintureId: l.ceintureId, matiereId: l.matiereId, rubriqueId: l.rubriqueId, titre: insensible(titre), id: { not: id } }, select: { id: true },
    }))) {
      throw new ConflictException('Cette leçon existe déjà dans cette matière, cette rubrique et cette ceinture.');
    }
    const maj = await this.protege(() => this.prisma.lecon.update({ where: { id }, data: { titre, ordre: dto.ordre }, select: { id: true, titre: true, ordre: true } }));
    if (titre !== undefined && l._count.notes > 0 && titre !== l.titre) {
      await this.prisma.journalAudit.create({
        data: { utilisateurId: acteurId, action: 'LECON_EVALUEE_TEXTE_MODIFIE', entite: 'Lecon', entiteId: id, details: { avant: l.titre, apres: titre, evaluations: l._count.notes } },
      });
    }
    return maj;
  }

  async supprimerLecon(id: number): Promise<{ message: string }> {
    const l = await this.prisma.lecon.findUnique({ where: { id }, select: { _count: { select: { notes: true, progressions: true } } } });
    if (!l) throw new NotFoundException('Leçon introuvable.');
    if (l._count.notes + l._count.progressions > 0) {
      throw new ConflictException(`Cette leçon est déjà utilisée (${l._count.notes} évaluation(s), ${l._count.progressions} suivi(s) de classe) : elle ne peut pas être supprimée. Vous pouvez corriger son titre.`);
    }
    await this.prisma.lecon.delete({ where: { id } });
    return { message: 'Leçon supprimée.' };
  }
}
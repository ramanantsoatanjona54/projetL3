import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreerCeintureDto, CreerCompetenceDto, CreerDomaineDto, CreerLeconDto, CreerRubriqueDto, CreerSemestreDto,
  CreerSousDomaineDto, DeplacerCeintureDto, DeplacerContenuDto, DeplacerDomainesDto, DeplacerLeconsDto,
  LibelleDto, ModifierCeintureDto, ModifierLeconDto, NomDto,
} from './dto/programmes.dto';

const nettoyer = (s: string) => s.trim().replace(/\s+/g, ' ');
const insensible = (v: string) => ({ equals: v, mode: 'insensitive' as const });
const minuscule = (s: string) => nettoyer(s).toLocaleLowerCase('fr');

function exiger(texte: string, champ: string): string {
  const t = nettoyer(texte);
  if (!t) throw new BadRequestException(`${champ} ne peut pas être vide.`);
  return t;
}

const COMPETENCE_SELECT = { id: true, libelle: true } satisfies Prisma.CompetenceSelect;

@Injectable()
export class ProgrammesService {
  constructor(private readonly prisma: PrismaService) {}

  // L'index unique de la base est le dernier rempart contre les doublons (deux clics simultanés).
  // P2003 : l'élément est encore référencé ailleurs, la suppression est refusée proprement.
  private async protege<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') throw new ConflictException('Cet élément existe déjà.');
        if (e.code === 'P2003') throw new ConflictException("Cet élément est encore utilisé ailleurs : il ne peut pas être supprimé.");
      }
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

  // Programme complet d'un niveau : domaines et compétences (préscolaire) ou leçons (autres cycles)
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
          orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
          select: {
            id: true, nom: true, ordre: true,
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
                _count: { select: { progressions: true } },
              },
            },
          },
        },
      },
    });
    return { niveau, type: niveau.classe.cycle === 'prescolaire' ? 'domaines' : 'lecons', semestres };
  }

  // ---------- Semestres ----------

  async creerSemestre(dto: CreerSemestreDto): Promise<unknown> {
    if (!(await this.prisma.niveau.findUnique({ where: { id: dto.niveauId }, select: { id: true } }))) throw new NotFoundException('Niveau introuvable.');
    if (await this.prisma.semestre.findFirst({ where: { niveauId: dto.niveauId, numero: dto.numero }, select: { id: true } })) {
      throw new ConflictException(`Le semestre ${dto.numero} existe déjà pour ce niveau.`);
    }
    return this.protege(() => this.prisma.semestre.create({ data: { niveauId: dto.niveauId, numero: dto.numero }, select: { id: true, numero: true } }));
  }

  async supprimerSemestre(id: number): Promise<{ message: string }> {
    const s = await this.prisma.semestre.findUnique({ where: { id }, select: { numero: true, _count: { select: { ceintures: true } } } });
    if (!s) throw new NotFoundException('Semestre introuvable.');
    if (s._count.ceintures > 0) {
      throw new ConflictException(`Le semestre ${s.numero} contient ${s._count.ceintures} ceinture(s). Déplacez-les vers l'autre semestre ou supprimez-les d'abord.`);
    }
    await this.protege(() => this.prisma.semestre.delete({ where: { id } }));
    return { message: 'Semestre supprimé.' };
  }

  // ---------- Ceintures ----------

  async creerCeinture(dto: CreerCeintureDto): Promise<unknown> {
    const nom = exiger(dto.nom, 'Le nom');
    if (!(await this.prisma.semestre.findUnique({ where: { id: dto.semestreId }, select: { id: true } }))) throw new NotFoundException('Semestre introuvable.');
    if (await this.prisma.ceinture.findFirst({ where: { semestreId: dto.semestreId, nom: insensible(nom) }, select: { id: true } })) {
      throw new ConflictException(`La ceinture « ${nom} » existe déjà dans ce semestre.`);
    }
    const ordre = dto.ordre ?? ((await this.prisma.ceinture.aggregate({ where: { semestreId: dto.semestreId }, _max: { ordre: true } }))._max.ordre ?? 0) + 1;
    return this.protege(() => this.prisma.ceinture.create({ data: { semestreId: dto.semestreId, nom, ordre }, select: { id: true, nom: true, ordre: true } }));
  }

  async modifierCeinture(id: number, dto: ModifierCeintureDto): Promise<unknown> {
    const c = await this.prisma.ceinture.findUnique({ where: { id }, select: { semestreId: true } });
    if (!c) throw new NotFoundException('Ceinture introuvable.');
    if (dto.nom === undefined && dto.ordre === undefined) throw new BadRequestException('Rien à modifier.');
    const nom = dto.nom !== undefined ? exiger(dto.nom, 'Le nom') : undefined;
    if (nom !== undefined && (await this.prisma.ceinture.findFirst({
      where: { semestreId: c.semestreId, nom: insensible(nom), id: { not: id } }, select: { id: true },
    }))) {
      throw new ConflictException(`La ceinture « ${nom} » existe déjà dans ce semestre.`);
    }
    return this.protege(() => this.prisma.ceinture.update({ where: { id }, data: { nom, ordre: dto.ordre }, select: { id: true, nom: true, ordre: true } }));
  }

  async supprimerCeinture(id: number): Promise<{ message: string }> {
    const c = await this.prisma.ceinture.findUnique({ where: { id }, select: { nom: true, _count: { select: { domaines: true, lecons: true } } } });
    if (!c) throw new NotFoundException('Ceinture introuvable.');
    const { domaines, lecons } = c._count;
    if (domaines + lecons > 0) {
      throw new ConflictException(`La ceinture « ${c.nom} » contient ${domaines} domaine(s) et ${lecons} leçon(s). Déplacez d'abord ce contenu vers une autre ceinture.`);
    }
    await this.protege(() => this.prisma.ceinture.delete({ where: { id } }));
    return { message: 'Ceinture supprimée.' };
  }

  // Une ceinture ne change de semestre qu'à l'intérieur du même niveau (ses leçons portent le niveau)
  async deplacerCeinture(id: number, dto: DeplacerCeintureDto): Promise<{ message: string }> {
    const c = await this.prisma.ceinture.findUnique({ where: { id }, select: { nom: true, semestreId: true, semestre: { select: { niveauId: true } } } });
    if (!c) throw new NotFoundException('Ceinture introuvable.');
    const cible = await this.prisma.semestre.findUnique({ where: { id: dto.semestreId }, select: { id: true, numero: true, niveauId: true } });
    if (!cible) throw new NotFoundException('Semestre introuvable.');
    if (cible.niveauId !== c.semestre.niveauId) throw new BadRequestException('Une ceinture ne peut changer de semestre qu\'à l\'intérieur du même niveau.');
    if (cible.id === c.semestreId) throw new BadRequestException('Cette ceinture est déjà dans ce semestre.');
    if (await this.prisma.ceinture.findFirst({ where: { semestreId: cible.id, nom: insensible(c.nom) }, select: { id: true } })) {
      throw new ConflictException(`Le semestre ${cible.numero} contient déjà une ceinture « ${c.nom} ».`);
    }
    const ordre = ((await this.prisma.ceinture.aggregate({ where: { semestreId: cible.id }, _max: { ordre: true } }))._max.ordre ?? 0) + 1;
    await this.protege(() => this.prisma.ceinture.update({ where: { id }, data: { semestreId: cible.id, ordre } }));
    return { message: `Ceinture « ${c.nom} » déplacée vers le semestre ${cible.numero}.` };
  }

  // ---------- Déplacement du contenu d'une ceinture ----------

  private async ceintureAvecNiveau(id: number) {
    const c = await this.prisma.ceinture.findUnique({ where: { id }, select: { id: true, nom: true, semestre: { select: { numero: true, niveauId: true } } } });
    if (!c) throw new NotFoundException('Ceinture introuvable.');
    return c;
  }

  // Vérifie tout avant de toucher à la base : même niveau, pas de doublon dans la ceinture cible
  private async preparerLecons(ids: number[], cible: { id: number; semestre: { niveauId: number } }) {
    if (ids.length === 0) return [];
    const lecons = await this.prisma.lecon.findMany({
      where: { id: { in: ids } },
      select: { id: true, titre: true, niveauId: true, ceintureId: true, matiereId: true, rubriqueId: true },
    });
    if (lecons.length !== new Set(ids).size) throw new NotFoundException('Une des leçons est introuvable.');
    if (lecons.some((l) => l.niveauId !== cible.semestre.niveauId)) {
      throw new BadRequestException('Une leçon ne peut être déplacée que vers une ceinture du même niveau.');
    }
    const aDeplacer = lecons.filter((l) => l.ceintureId !== cible.id);
    if (aDeplacer.length === 0) return [];

    const existantes = await this.prisma.lecon.findMany({
      where: { niveauId: cible.semestre.niveauId, ceintureId: cible.id },
      select: { matiereId: true, rubriqueId: true, titre: true },
    });
    const cle = (l: { matiereId: number; rubriqueId: number | null; titre: string }) => `${l.matiereId}|${l.rubriqueId ?? 0}|${minuscule(l.titre)}`;
    const prises = new Set(existantes.map(cle));
    const doublons: string[] = [];
    for (const l of aDeplacer) {
      const k = cle(l);
      if (prises.has(k)) doublons.push(l.titre); else prises.add(k);
    }
    if (doublons.length > 0) {
      const exemples = doublons.slice(0, 3).map((t) => `« ${t} »`).join(', ');
      throw new ConflictException(`Déplacement refusé : ${doublons.length} leçon(s) existent déjà dans la ceinture cible (${exemples}${doublons.length > 3 ? '…' : ''}).`);
    }
    return aDeplacer;
  }

  private async preparerDomaines(ids: number[], cible: { id: number; semestre: { niveauId: number } }) {
    if (ids.length === 0) return [];
    const domaines = await this.prisma.domaine.findMany({
      where: { id: { in: ids } },
      select: { id: true, nom: true, ceintureId: true, ceinture: { select: { semestre: { select: { niveauId: true } } } } },
    });
    if (domaines.length !== new Set(ids).size) throw new NotFoundException('Un des domaines est introuvable.');
    if (domaines.some((d) => d.ceinture.semestre.niveauId !== cible.semestre.niveauId)) {
      throw new BadRequestException('Un domaine ne peut être déplacé que vers une ceinture du même niveau.');
    }
    const aDeplacer = domaines.filter((d) => d.ceintureId !== cible.id);
    if (aDeplacer.length === 0) return [];

    const existants = await this.prisma.domaine.findMany({ where: { ceintureId: cible.id }, select: { nom: true } });
    const prises = new Set(existants.map((d) => minuscule(d.nom)));
    const doublons: string[] = [];
    for (const d of aDeplacer) {
      const k = minuscule(d.nom);
      if (prises.has(k)) doublons.push(d.nom); else prises.add(k);
    }
    if (doublons.length > 0) {
      throw new ConflictException(`Déplacement refusé : le domaine ${doublons.slice(0, 3).map((n) => `« ${n} »`).join(', ')} existe déjà dans la ceinture cible.`);
    }
    return aDeplacer;
  }

  async deplacerLecons(acteurId: number, dto: DeplacerLeconsDto): Promise<unknown> {
    const cible = await this.ceintureAvecNiveau(dto.ceintureId);
    const aDeplacer = await this.preparerLecons(dto.leconIds, cible);
    if (aDeplacer.length === 0) throw new BadRequestException('Ces leçons sont déjà dans cette ceinture.');

    const ids = aDeplacer.map((l) => l.id);
    await this.prisma.$transaction([
      this.prisma.lecon.updateMany({ where: { id: { in: ids } }, data: { ceintureId: cible.id } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId, action: 'PROGRAMME_LECONS_DEPLACEES', entite: 'Ceinture', entiteId: cible.id,
          details: { versCeinture: cible.nom, versSemestre: cible.semestre.numero, leconIds: ids },
        },
      }),
    ]);
    return { message: `${ids.length} leçon(s) déplacée(s) vers « ${cible.nom} » (semestre ${cible.semestre.numero}).`, deplacees: ids.length };
  }

  async deplacerDomaines(acteurId: number, dto: DeplacerDomainesDto): Promise<unknown> {
    const cible = await this.ceintureAvecNiveau(dto.ceintureId);
    const aDeplacer = await this.preparerDomaines(dto.domaineIds, cible);
    if (aDeplacer.length === 0) throw new BadRequestException('Ces domaines sont déjà dans cette ceinture.');

    const ids = aDeplacer.map((d) => d.id);
    await this.prisma.$transaction([
      this.prisma.domaine.updateMany({ where: { id: { in: ids } }, data: { ceintureId: cible.id } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId, action: 'PROGRAMME_DOMAINES_DEPLACES', entite: 'Ceinture', entiteId: cible.id,
          details: { versCeinture: cible.nom, versSemestre: cible.semestre.numero, domaineIds: ids },
        },
      }),
    ]);
    return { message: `${ids.length} domaine(s) déplacé(s) vers « ${cible.nom} » (semestre ${cible.semestre.numero}).`, deplaces: ids.length };
  }

  // Vide une ceinture dans une autre : tout ou rien (une seule transaction)
  async deplacerContenuCeinture(acteurId: number, id: number, dto: DeplacerContenuDto): Promise<unknown> {
    if (id === dto.versCeintureId) throw new BadRequestException('Choisissez une autre ceinture.');
    const source = await this.ceintureAvecNiveau(id);
    const cible = await this.ceintureAvecNiveau(dto.versCeintureId);
    if (source.semestre.niveauId !== cible.semestre.niveauId) {
      throw new BadRequestException('Le contenu ne peut être déplacé que vers une ceinture du même niveau.');
    }

    const [domaines, lecons] = await Promise.all([
      this.prisma.domaine.findMany({ where: { ceintureId: id }, select: { id: true } }),
      this.prisma.lecon.findMany({ where: { ceintureId: id }, select: { id: true } }),
    ]);
    if (domaines.length + lecons.length === 0) throw new BadRequestException('Cette ceinture est déjà vide.');

    const dom = await this.preparerDomaines(domaines.map((d) => d.id), cible);
    const lec = await this.preparerLecons(lecons.map((l) => l.id), cible);

    await this.prisma.$transaction([
      this.prisma.domaine.updateMany({ where: { id: { in: dom.map((d) => d.id) } }, data: { ceintureId: cible.id } }),
      this.prisma.lecon.updateMany({ where: { id: { in: lec.map((l) => l.id) } }, data: { ceintureId: cible.id } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId, action: 'PROGRAMME_CONTENU_DEPLACE', entite: 'Ceinture', entiteId: id,
          details: {
            depuis: `${source.nom} (semestre ${source.semestre.numero})`, vers: `${cible.nom} (semestre ${cible.semestre.numero})`,
            domaines: dom.length, lecons: lec.length,
          },
        },
      }),
    ]);
    return {
      message: `Contenu déplacé vers « ${cible.nom} » (semestre ${cible.semestre.numero}) : ${dom.length} domaine(s), ${lec.length} leçon(s).`,
    };
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

  async modifierCompetence(_acteurId: number, id: number, dto: LibelleDto): Promise<unknown> {
    const c = await this.prisma.competence.findUnique({
      where: { id }, select: { domaineId: true, sousDomaineId: true },
    });
    if (!c) throw new NotFoundException('Compétence introuvable.');
    const libelle = exiger(dto.libelle, 'Le libellé');
    const parent = c.domaineId != null ? { domaineId: c.domaineId } : { sousDomaineId: c.sousDomaineId };
    if (await this.prisma.competence.findFirst({ where: { ...parent, libelle: insensible(libelle), id: { not: id } }, select: { id: true } })) {
      throw new ConflictException('Cette compétence existe déjà à cet endroit.');
    }
    return this.protege(() => this.prisma.competence.update({ where: { id }, data: { libelle }, select: { id: true, libelle: true } }));
  }

  async supprimerCompetence(id: number): Promise<{ message: string }> {
    // Les compétences ne portent plus d'évaluation d'élève (elles figurent au bulletin via son propre contenu) : suppression libre
    if (!(await this.prisma.competence.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Compétence introuvable.');
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

  async modifierLecon(_acteurId: number, id: number, dto: ModifierLeconDto): Promise<unknown> {
    const l = await this.prisma.lecon.findUnique({
      where: { id },
      select: { titre: true, niveauId: true, ceintureId: true, matiereId: true, rubriqueId: true },
    });
    if (!l) throw new NotFoundException('Leçon introuvable.');
    const titre = dto.titre !== undefined ? exiger(dto.titre, 'Le titre') : undefined;
    if (titre !== undefined && (await this.prisma.lecon.findFirst({
      where: { niveauId: l.niveauId, ceintureId: l.ceintureId, matiereId: l.matiereId, rubriqueId: l.rubriqueId, titre: insensible(titre), id: { not: id } }, select: { id: true },
    }))) {
      throw new ConflictException('Cette leçon existe déjà dans cette matière, cette rubrique et cette ceinture.');
    }
    return this.protege(() => this.prisma.lecon.update({ where: { id }, data: { titre, ordre: dto.ordre }, select: { id: true, titre: true, ordre: true } }));
  }

  async supprimerLecon(id: number): Promise<{ message: string }> {
    const l = await this.prisma.lecon.findUnique({ where: { id }, select: { _count: { select: { progressions: true } } } });
    if (!l) throw new NotFoundException('Leçon introuvable.');
    if (l._count.progressions > 0) {
      throw new ConflictException(`Cette leçon a déjà été vue par ${l._count.progressions} salle(s) : elle ne peut pas être supprimée. Vous pouvez corriger son titre.`);
    }
    await this.prisma.lecon.delete({ where: { id } });
    return { message: 'Leçon supprimée.' };
  }
}
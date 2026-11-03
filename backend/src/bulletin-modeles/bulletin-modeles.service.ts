import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeElementBulletin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CopierModeleDto, CreerElementDto, DeplacerElementDto, ModifierElementDto, OrdreElementDto,
} from './dto/bulletin-modeles.dto';

const nettoyer = (s: string) => s.trim().replace(/\s+/g, ' ');
const insensible = (v: string) => ({ equals: v, mode: 'insensitive' as const });

const NOM_TYPE: Record<TypeElementBulletin, string> = { DISCIPLINE: 'La discipline', RUBRIQUE: 'La rubrique', LIGNE: 'La ligne' };

export interface Noeud {
  id: number;
  type: TypeElementBulletin;
  libelle: string;
  archive: boolean;
  evaluations: number; // pour une ligne : nombre d'eleves evalues ; sinon : total des lignes qu'elle contient
  enfants: Noeud[];
}

@Injectable()
export class BulletinModelesService {
  constructor(private readonly prisma: PrismaService) {}

  // L'index unique de la base est le dernier rempart contre les doublons (deux clics simultanes)
  private async protege<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') throw new ConflictException('Cet élément existe déjà à cet endroit.');
        if (e.code === 'P2003') throw new ConflictException('Cet élément est encore utilisé : il ne peut pas être supprimé.');
      }
      throw e;
    }
  }

  // ---------- Lecture ----------

  // Tous les semestres de tous les niveaux, pour choisir une structure a copier
  async semestres(): Promise<unknown> {
    const rows = await this.prisma.semestre.findMany({
      orderBy: [{ niveau: { classe: { ordre: 'asc' } } }, { niveau: { ordre: 'asc' } }, { numero: 'asc' }],
      select: {
        id: true, numero: true,
        niveau: { select: { id: true, nom: true, classe: { select: { nom: true } } } },
        _count: { select: { elementsBulletin: true } },
      },
    });
    return rows.map((s) => ({ id: s.id, numero: s.numero, niveau: s.niveau.nom, classe: s.niveau.classe.nom, elements: s._count.elementsBulletin }));
  }

  async arbre(niveauId: number): Promise<unknown> {
    const niveau = await this.prisma.niveau.findUnique({
      where: { id: niveauId }, select: { id: true, nom: true, classe: { select: { nom: true } } },
    });
    if (!niveau) throw new NotFoundException('Niveau introuvable.');

    const semestres = await this.prisma.semestre.findMany({
      where: { niveauId }, orderBy: { numero: 'asc' },
      select: {
        id: true, numero: true,
        elementsBulletin: {
          orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
          select: { id: true, parentId: true, type: true, libelle: true, archiveLe: true, _count: { select: { evaluations: true } } },
        },
      },
    });

    return {
      niveau,
      semestres: semestres.map((s) => {
        const noeuds = new Map<number, Noeud>();
        for (const e of s.elementsBulletin) {
          noeuds.set(e.id, { id: e.id, type: e.type, libelle: e.libelle, archive: e.archiveLe !== null, evaluations: e._count.evaluations, enfants: [] });
        }
        const racines: Noeud[] = [];
        for (const e of s.elementsBulletin) {
          const n = noeuds.get(e.id)!;
          const parent = e.parentId !== null ? noeuds.get(e.parentId) : undefined;
          if (parent) parent.enfants.push(n); else racines.push(n);
        }
        const total = (n: Noeud): number => { if (n.enfants.length) n.evaluations = n.enfants.reduce((t, c) => t + total(c), 0); return n.evaluations; };
        racines.forEach(total);
        return { id: s.id, numero: s.numero, disciplines: racines };
      }),
    };
  }

  // ---------- Outils ----------

  private async exiger(id: number) {
    const e = await this.prisma.elementBulletin.findUnique({
      where: { id },
      select: { id: true, semestreId: true, parentId: true, type: true, libelle: true, archiveLe: true, _count: { select: { enfants: true, evaluations: true } } },
    });
    if (!e) throw new NotFoundException('Élément introuvable.');
    return e;
  }

  // Verifie que le parent convient au type demande (discipline > rubrique > ligne) et au meme semestre
  private async verifierParent(type: TypeElementBulletin, semestreId: number, parentId: number | null | undefined) {
    if (type === 'DISCIPLINE') {
      if (parentId != null) throw new BadRequestException("Une discipline n'a pas de parent.");
      return;
    }
    if (parentId == null) throw new BadRequestException(type === 'RUBRIQUE' ? 'Une rubrique appartient à une discipline.' : 'Une ligne appartient à une rubrique ou à une discipline.');
    const p = await this.prisma.elementBulletin.findUnique({ where: { id: parentId }, select: { semestreId: true, type: true, archiveLe: true } });
    if (!p) throw new NotFoundException('Parent introuvable.');
    if (p.semestreId !== semestreId) throw new BadRequestException("Le parent n'appartient pas à ce semestre.");
    if (p.archiveLe) throw new BadRequestException('Le parent est archivé : restaurez-le d’abord.');
    const permis: TypeElementBulletin[] = type === 'RUBRIQUE' ? ['DISCIPLINE'] : ['RUBRIQUE', 'DISCIPLINE'];
    if (!permis.includes(p.type)) throw new BadRequestException('Ce parent ne convient pas à ce type d’élément.');
  }

  private async doublon(semestreId: number, parentId: number | null, libelle: string, sauf?: number) {
    return this.prisma.elementBulletin.findFirst({
      where: { semestreId, parentId, libelle: insensible(libelle), ...(sauf ? { id: { not: sauf } } : {}) }, select: { id: true },
    });
  }

  private async prochainOrdre(semestreId: number, parentId: number | null) {
    const m = await this.prisma.elementBulletin.aggregate({ where: { semestreId, parentId }, _max: { ordre: true } });
    return (m._max.ordre ?? 0) + 1;
  }

  // L'element et tout ce qu'il contient
  private async sousArbre(id: number): Promise<number[]> {
    const ids = [id];
    let niveau = [id];
    while (niveau.length) {
      const enfants = await this.prisma.elementBulletin.findMany({ where: { parentId: { in: niveau } }, select: { id: true } });
      niveau = enfants.map((e) => e.id);
      ids.push(...niveau);
    }
    return ids;
  }

  // ---------- Ecriture (ADMIN) ----------

  async creer(dto: CreerElementDto): Promise<unknown> {
    const libelle = nettoyer(dto.libelle);
    if (!libelle) throw new BadRequestException('Le libellé ne peut pas être vide.');
    if (!(await this.prisma.semestre.findUnique({ where: { id: dto.semestreId }, select: { id: true } }))) throw new NotFoundException('Semestre introuvable.');
    const parentId = dto.parentId ?? null;
    await this.verifierParent(dto.type, dto.semestreId, parentId);
    if (await this.doublon(dto.semestreId, parentId, libelle)) {
      throw new ConflictException(`${NOM_TYPE[dto.type]} « ${libelle} » existe déjà à cet endroit.`);
    }
    const ordre = await this.prochainOrdre(dto.semestreId, parentId);
    return this.protege(() => this.prisma.elementBulletin.create({
      data: { semestreId: dto.semestreId, parentId, type: dto.type, libelle, ordre }, select: { id: true, libelle: true },
    }));
  }

  async modifier(acteurId: number, id: number, dto: ModifierElementDto): Promise<unknown> {
    const e = await this.exiger(id);
    const libelle = nettoyer(dto.libelle);
    if (!libelle) throw new BadRequestException('Le libellé ne peut pas être vide.');
    if (await this.doublon(e.semestreId, e.parentId, libelle, id)) throw new ConflictException(`${NOM_TYPE[e.type]} « ${libelle} » existe déjà à cet endroit.`);
    const maj = await this.protege(() => this.prisma.elementBulletin.update({ where: { id }, data: { libelle }, select: { id: true, libelle: true } }));
    if (e.type === 'LIGNE' && e._count.evaluations > 0 && e.libelle !== libelle) {
      await this.prisma.journalAudit.create({
        data: { utilisateurId: acteurId, action: 'LIGNE_BULLETIN_EVALUEE_TEXTE_MODIFIE', entite: 'ElementBulletin', entiteId: id, details: { avant: e.libelle, apres: libelle, evaluations: e._count.evaluations } },
      });
    }
    return maj;
  }

  async supprimer(id: number): Promise<{ message: string }> {
    const e = await this.exiger(id);
    if (e._count.enfants > 0) throw new ConflictException(`« ${e.libelle} » contient ${e._count.enfants} élément(s). Videz-le ou archivez-le d'abord.`);
    if (e._count.evaluations > 0) {
      throw new ConflictException(`Cette ligne est déjà évaluée pour ${e._count.evaluations} élève(s) : elle ne peut pas être supprimée. Archivez-la : elle ne sera plus exigée pour les prochains bulletins.`);
    }
    await this.protege(() => this.prisma.elementBulletin.delete({ where: { id } }));
    return { message: 'Élément supprimé.' };
  }

  async archiver(id: number): Promise<{ message: string }> {
    const e = await this.exiger(id);
    if (e.archiveLe) throw new BadRequestException('Cet élément est déjà archivé.');
    const ids = await this.sousArbre(id);
    const r = await this.prisma.elementBulletin.updateMany({ where: { id: { in: ids }, archiveLe: null }, data: { archiveLe: new Date() } });
    return { message: `${r.count} élément(s) archivé(s).` };
  }

  async restaurer(id: number): Promise<{ message: string }> {
    const e = await this.exiger(id);
    if (!e.archiveLe) throw new BadRequestException("Cet élément n'est pas archivé.");
    if (e.parentId !== null) {
      const p = await this.prisma.elementBulletin.findUnique({ where: { id: e.parentId }, select: { archiveLe: true } });
      if (p?.archiveLe) throw new BadRequestException('Son parent est archivé : restaurez-le d’abord.');
    }
    const ids = await this.sousArbre(id);
    const r = await this.prisma.elementBulletin.updateMany({ where: { id: { in: ids } }, data: { archiveLe: null } });
    return { message: `${r.count} élément(s) restauré(s).` };
  }

  // Une ligne ou une rubrique change de parent, dans le meme semestre (ses evaluations la suivent)
  async deplacer(id: number, dto: DeplacerElementDto): Promise<{ message: string }> {
    const e = await this.exiger(id);
    if (e.type === 'DISCIPLINE') throw new BadRequestException('Une discipline ne se déplace pas : changez son ordre.');
    if (e.parentId === dto.parentId) throw new BadRequestException('Cet élément est déjà à cet endroit.');
    await this.verifierParent(e.type, e.semestreId, dto.parentId);
    if (await this.doublon(e.semestreId, dto.parentId, e.libelle)) throw new ConflictException(`« ${e.libelle} » existe déjà à l'endroit choisi.`);
    const ordre = await this.prochainOrdre(e.semestreId, dto.parentId);
    await this.protege(() => this.prisma.elementBulletin.update({ where: { id }, data: { parentId: dto.parentId, ordre } }));
    return { message: 'Élément déplacé.' };
  }

  // Echange avec le voisin : on renumerote d'abord les freres (1, 2, 3...) pour eviter les egalites
  async changerOrdre(id: number, dto: OrdreElementDto): Promise<{ message: string }> {
    const e = await this.exiger(id);
    const freres = await this.prisma.elementBulletin.findMany({
      where: { semestreId: e.semestreId, parentId: e.parentId }, orderBy: [{ ordre: 'asc' }, { id: 'asc' }], select: { id: true },
    });
    const ids = freres.map((f) => f.id);
    const i = ids.indexOf(id);
    const j = dto.sens === 'haut' ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) throw new BadRequestException(dto.sens === 'haut' ? 'Déjà en première position.' : 'Déjà en dernière position.');
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await this.prisma.$transaction(ids.map((x, k) => this.prisma.elementBulletin.update({ where: { id: x }, data: { ordre: k + 1 } })));
    return { message: 'Ordre modifié.' };
  }

  // Copie la structure d'un autre semestre dans un semestre VIDE (les elements archives ne sont pas copies)
  async copier(semestreId: number, dto: CopierModeleDto): Promise<{ message: string }> {
    if (semestreId === dto.depuisSemestreId) throw new BadRequestException('Choisissez un autre semestre.');
    const [cible, source] = await Promise.all([
      this.prisma.semestre.findUnique({ where: { id: semestreId }, select: { id: true, _count: { select: { elementsBulletin: true } } } }),
      this.prisma.semestre.findUnique({ where: { id: dto.depuisSemestreId }, select: { id: true } }),
    ]);
    if (!cible || !source) throw new NotFoundException('Semestre introuvable.');
    if (cible._count.elementsBulletin > 0) throw new ConflictException("Ce semestre contient déjà des éléments : la copie n'est possible que dans un semestre vide.");

    const elements = await this.prisma.elementBulletin.findMany({
      where: { semestreId: source.id, archiveLe: null }, orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
      select: { id: true, parentId: true, type: true, libelle: true, ordre: true },
    });
    if (elements.length === 0) throw new BadRequestException("Le semestre choisi n'a rien à copier.");

    await this.prisma.$transaction(async (tx) => {
      const nouveau = new Map<number, number>();
      // Les parents avant les enfants : on traite par profondeur (discipline, rubrique, ligne)
      for (const profondeur of ['DISCIPLINE', 'RUBRIQUE', 'LIGNE'] as TypeElementBulletin[]) {
        for (const e of elements.filter((x) => x.type === profondeur)) {
          const parentId = e.parentId !== null ? nouveau.get(e.parentId) : null;
          if (e.parentId !== null && parentId === undefined) continue; // parent archive : non copie
          const c = await tx.elementBulletin.create({
            data: { semestreId: cible.id, parentId: parentId ?? null, type: e.type, libelle: e.libelle, ordre: e.ordre }, select: { id: true },
          });
          nouveau.set(e.id, c.id);
        }
      }
    });
    return { message: `Structure copiée (${elements.length} élément(s)).` };
  }
}
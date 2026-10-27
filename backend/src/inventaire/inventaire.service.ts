import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TypeInventaire } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreerArticleDto, ModifierArticleDto, MouvementDto, STOCK_MAX } from './dto/inventaire.dto';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
export interface Acteur { id: number }
export interface FiltresInventaire { page?: string; taille?: string; type?: string; q?: string; rupture?: string }
export interface FiltresHistorique { page?: string; taille?: string }

@Injectable()
export class InventaireService {
  constructor(private readonly prisma: PrismaService) {}

  async lister(f: FiltresInventaire) {
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(100, Math.max(1, parseInt(f.taille ?? '25', 10) || 25));
    if (f.type && !(f.type in TypeInventaire)) throw new BadRequestException('Type invalide.');
    const q = f.q?.trim();
    const where: Prisma.InventaireWhereInput = {
      ...(f.type ? { type: f.type as TypeInventaire } : {}),
      ...(q ? { libelle: { contains: q, mode: 'insensitive' } } : {}),
      ...(f.rupture === '1' ? { quantite: 0 } : {}),
    };
    const [total, enRupture, rows] = await Promise.all([
      this.prisma.inventaire.count({ where }),
      this.prisma.inventaire.count({ where: { quantite: 0 } }),
      this.prisma.inventaire.findMany({
        where, orderBy: [{ libelle: 'asc' }, { id: 'asc' }], skip: (page - 1) * taille, take: taille,
      }),
    ]);
    return { total, page, taille, enRupture, lignes: rows };
  }

  private async verifierDoublon(libelle: string, type: TypeInventaire, exclureId?: number) {
    const doublon = await this.prisma.inventaire.findFirst({
      where: { type, libelle: { equals: libelle, mode: 'insensitive' }, id: exclureId ? { not: exclureId } : undefined },
      select: { id: true },
    });
    if (doublon) throw new ConflictException('Un article porte déjà ce libellé dans cette catégorie.');
  }

  private erreurUnicite(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Un article porte déjà ce libellé dans cette catégorie.');
    }
    throw e;
  }

  async creer(dto: CreerArticleDto, acteur: Acteur) {
    const libelle = norm(dto.libelle);
    if (libelle.length < 2) throw new BadRequestException('Libellé trop court.');
    await this.verifierDoublon(libelle, dto.type);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const a = await tx.inventaire.create({
          data: { libelle, type: dto.type, quantite: dto.quantite },
          select: { id: true, libelle: true, quantite: true },
        });
        // L'historique doit toujours expliquer le stock : on trace la quantité de départ
        if (dto.quantite > 0) {
          await tx.mouvementInventaire.create({
            data: { inventaireId: a.id, type: 'ENTREE', quantite: dto.quantite, utilisateurId: acteur.id, motif: 'Stock initial', dateMouvement: new Date() },
          });
        }
        await tx.journalAudit.create({
          data: {
            utilisateurId: acteur.id, action: 'INVENTAIRE_ARTICLE_CREE', entite: 'Inventaire', entiteId: a.id,
            details: { libelle, type: dto.type, quantiteInitiale: dto.quantite },
          },
        });
        return a;
      });
    } catch (e) {
      this.erreurUnicite(e);
    }
  }

  async modifier(id: number, dto: ModifierArticleDto, acteur: Acteur) {
    const ex = await this.prisma.inventaire.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Article introuvable');
    if (dto.libelle === undefined && dto.type === undefined) throw new BadRequestException('Aucune modification à enregistrer.');
    const libelle = dto.libelle !== undefined ? norm(dto.libelle) : ex.libelle;
    const type = dto.type ?? ex.type;
    await this.verifierDoublon(libelle, type, id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const a = await tx.inventaire.update({ where: { id }, data: { libelle, type }, select: { id: true } });
        await tx.journalAudit.create({
          data: {
            utilisateurId: acteur.id, action: 'INVENTAIRE_MODIFIE', entite: 'Inventaire', entiteId: id,
            details: { avant: { libelle: ex.libelle, type: ex.type }, apres: { libelle, type } },
          },
        });
        return a;
      });
    } catch (e) {
      this.erreurUnicite(e);
    }
  }

  async mouvement(id: number, sens: 'ENTREE' | 'SORTIE', dto: MouvementDto, acteur: Acteur) {
    const motif = dto.motif?.trim() || null;
    if (sens === 'SORTIE' && (!motif || motif.length < 3)) {
      throw new BadRequestException('Indiquez le motif de la sortie (3 caractères minimum).');
    }
    const q = dto.quantite;

    return this.prisma.$transaction(async (tx) => {
      const art = await tx.inventaire.findUnique({ where: { id }, select: { id: true, libelle: true, quantite: true } });
      if (!art) throw new NotFoundException('Article introuvable');

      // Mise à jour CONDITIONNELLE : atomique, donc jamais de stock négatif ni de dépassement
      const r = await tx.inventaire.updateMany({
        where: sens === 'ENTREE' ? { id, quantite: { lte: STOCK_MAX - q } } : { id, quantite: { gte: q } },
        data: { quantite: sens === 'ENTREE' ? { increment: q } : { decrement: q }, dateMaj: new Date() },
      });
      if (r.count === 0) {
        throw new ConflictException(
          sens === 'SORTIE'
            ? `Stock insuffisant : ${art.quantite} disponible(s).`
            : `Le stock dépasserait la limite de ${STOCK_MAX.toLocaleString('fr-FR')}.`,
        );
      }
      const apres = (await tx.inventaire.findUniqueOrThrow({ where: { id }, select: { quantite: true } })).quantite;
      const avant = sens === 'ENTREE' ? apres - q : apres + q;

      await tx.mouvementInventaire.create({
        data: { inventaireId: id, type: sens, quantite: q, utilisateurId: acteur.id, motif, dateMouvement: new Date() },
      });
      await tx.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'INVENTAIRE_MOUVEMENT', entite: 'Inventaire', entiteId: id,
          details: { article: art.libelle, sens, quantite: q, avant, apres, motif },
        },
      });
      return { id, quantite: apres };
    });
  }

  async historique(id: number, f: FiltresHistorique) {
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(100, Math.max(1, parseInt(f.taille ?? '25', 10) || 25));
    const article = await this.prisma.inventaire.findUnique({
      where: { id }, select: { id: true, libelle: true, type: true, quantite: true },
    });
    if (!article) throw new NotFoundException('Article introuvable');

    const [total, rows] = await Promise.all([
      this.prisma.mouvementInventaire.count({ where: { inventaireId: id } }),
      this.prisma.mouvementInventaire.findMany({
        where: { inventaireId: id }, orderBy: [{ dateMouvement: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * taille, take: taille,
        select: {
          id: true, type: true, quantite: true, motif: true, dateMouvement: true,
          utilisateur: { select: { email: true, personnel: { select: { nom: true, prenom: true } } } },
        },
      }),
    ]);
    return {
      article, total, page, taille,
      lignes: rows.map((m) => ({
        id: m.id, type: m.type, quantite: m.quantite, motif: m.motif, date: m.dateMouvement,
        par: m.utilisateur.personnel ? `${m.utilisateur.personnel.prenom} ${m.utilisateur.personnel.nom}` : m.utilisateur.email,
      })),
    };
  }

  async supprimer(id: number, acteur: Acteur) {
    const a = await this.prisma.inventaire.findUnique({ where: { id }, select: { libelle: true, quantite: true } });
    if (!a) throw new NotFoundException('Article introuvable');
    if (a.quantite !== 0) throw new ConflictException('Seul un article dont le stock est à 0 peut être supprimé. Enregistrez d\'abord la sortie du reste.');
    const nbMouvements = await this.prisma.mouvementInventaire.count({ where: { inventaireId: id } });
    await this.prisma.$transaction([
      this.prisma.mouvementInventaire.deleteMany({ where: { inventaireId: id } }),
      this.prisma.inventaire.delete({ where: { id } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'INVENTAIRE_ARTICLE_SUPPRIME', entite: 'Inventaire', entiteId: id,
          details: { libelle: a.libelle, mouvementsSupprimes: nbMouvements },
        },
      }),
    ]);
    return { message: 'Article supprimé' };
  }
}
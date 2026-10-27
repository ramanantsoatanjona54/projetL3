import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TYPES_PUBLICATION } from './constantes';
import { CreerPublicationDto, ModifierPublicationDto } from './dto/communication.dto';

export interface Acteur { id: number; role: RoleUtilisateur }
export interface FiltresPublications { page?: string; taille?: string; type?: string }

@Injectable()
export class PublicationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Un parent ne voit QUE les annonces publiques ; le personnel voit tout
  async lister(acteur: Acteur, f: FiltresPublications) {
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(50, Math.max(1, parseInt(f.taille ?? '10', 10) || 10));
    if (f.type && !(TYPES_PUBLICATION as readonly string[]).includes(f.type)) throw new BadRequestException('Type invalide.');

    const where: Prisma.PublicationWhereInput = {
      ...(f.type ? { type: f.type } : {}),
      ...(acteur.role === RoleUtilisateur.PARENT ? { visiblePublic: true } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.publication.count({ where }),
      this.prisma.publication.findMany({
        where, orderBy: [{ datePublication: 'desc' }, { id: 'desc' }], skip: (page - 1) * taille, take: taille,
      }),
    ]);
    return {
      total, page, taille,
      lignes: rows.map((p) => ({
        id: p.id, titre: p.titre, contenu: p.contenu, type: p.type, visiblePublic: p.visiblePublic, date: p.datePublication,
      })),
    };
  }

  async creer(dto: CreerPublicationDto, acteur: Acteur) {
    const titre = dto.titre.trim();
    const contenu = dto.contenu.trim();
    if (titre.length < 3 || contenu.length < 10) throw new BadRequestException('Titre ou contenu trop court.');

    const doublon = await this.prisma.publication.findFirst({
      where: { titre: { equals: titre, mode: 'insensitive' }, datePublication: { gte: new Date(Date.now() - 24 * 3_600_000) } },
      select: { id: true },
    });
    if (doublon) throw new ConflictException('Une publication avec ce titre existe déjà depuis moins de 24 h.');

    // Annonce interne : personnel seulement. Annonce publique : tout le monde (parents inclus)
    const destinataires = await this.prisma.utilisateur.findMany({
      where: {
        actif: true, id: { not: acteur.id },
        ...(dto.visiblePublic ? {} : { role: { not: RoleUtilisateur.PARENT } }),
      },
      select: { id: true },
    });
    const prefixe = dto.type === 'URGENT' ? 'Urgent : ' : dto.visiblePublic ? 'Nouvelle annonce : ' : 'Information interne : ';
    const message = `${prefixe}${titre}`.slice(0, 190);

    return this.prisma.$transaction(async (tx) => {
      const p = await tx.publication.create({
        data: { titre, contenu, type: dto.type, visiblePublic: dto.visiblePublic },
      });
      if (destinataires.length > 0) {
        await tx.notification.createMany({ data: destinataires.map((d) => ({ utilisateurId: d.id, message })) });
      }
      await tx.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'PUBLICATION_CREEE', entite: 'Publication', entiteId: p.id,
          details: { titre, type: dto.type, visiblePublic: dto.visiblePublic, destinataires: destinataires.length },
        },
      });
      return p;
    });
  }

  async modifier(id: number, dto: ModifierPublicationDto, acteur: Acteur) {
    const existante = await this.prisma.publication.findUnique({ where: { id }, select: { id: true } });
    if (!existante) throw new NotFoundException('Publication introuvable');

    const data: Prisma.PublicationUpdateInput = {};
    if (dto.titre !== undefined) data.titre = dto.titre.trim();
    if (dto.contenu !== undefined) data.contenu = dto.contenu.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.visiblePublic !== undefined) data.visiblePublic = dto.visiblePublic;
    const champs = Object.keys(data);
    if (champs.length === 0) throw new BadRequestException('Aucune modification à enregistrer.');

    return this.prisma.$transaction(async (tx) => {
      const p = await tx.publication.update({ where: { id }, data });
      await tx.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'PUBLICATION_MODIFIEE', entite: 'Publication', entiteId: id, details: { champs } },
      });
      return p;
    });
  }

  async supprimer(id: number, acteur: Acteur) {
    const p = await this.prisma.publication.findUnique({ where: { id }, select: { titre: true } });
    if (!p) throw new NotFoundException('Publication introuvable');
    await this.prisma.$transaction([
      this.prisma.publication.delete({ where: { id } }),
      this.prisma.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'PUBLICATION_SUPPRIMEE', entite: 'Publication', entiteId: id, details: { titre: p.titre } },
      }),
    ]);
    return { message: 'Publication supprimée' };
  }
}
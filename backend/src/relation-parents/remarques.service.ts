import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EnvoyerRemarqueDto } from './dto/relation-parents.dto';
import { parentIdDe } from './parent-courant';

const MAX_PAR_JOUR = 5;
const ZONE = 'Indian/Antananarivo';
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export interface Acteur { id: number; role: RoleUtilisateur }
export interface FiltresRemarques { traitee?: string; page?: string; taille?: string }

@Injectable()
export class RemarquesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Parent ----------

  async envoyer(userId: number, dto: EnvoyerRemarqueDto) {
    const parentId = await parentIdDe(this.prisma, userId);
    const contenu = dto.contenu.trim();
    if (contenu.length < 10) throw new BadRequestException('La remarque doit contenir au moins 10 caractères.');

    const recentes = await this.prisma.remarqueParent.findMany({
      where: { parentId, dateCreation: { gte: new Date(Date.now() - 24 * 3_600_000) } },
      select: { contenu: true },
    });
    if (recentes.length >= MAX_PAR_JOUR) {
      throw new HttpException(`Limite atteinte : ${MAX_PAR_JOUR} remarques par jour. Réessayez demain.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recentes.some((r) => norm(r.contenu) === norm(contenu))) {
      throw new ConflictException('Vous avez déjà envoyé cette remarque.');
    }

    const destinataires = await this.prisma.utilisateur.findMany({
      where: { actif: true, role: { in: [RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE] } },
      select: { id: true },
    });
    const parent = await this.prisma.parent.findUnique({ where: { id: parentId }, select: { nom: true, prenom: true } });
    const nom = `${parent?.prenom ?? ''} ${parent?.nom ?? ''}`.trim();

    return this.prisma.$transaction(async (tx) => {
      const r = await tx.remarqueParent.create({
        data: { parentId, utilisateurId: userId, contenu },
        select: { id: true, dateCreation: true },
      });
      if (destinataires.length > 0) {
        await tx.notification.createMany({
          data: destinataires.map((d) => ({ utilisateurId: d.id, message: `Nouvelle remarque de ${nom}.` })),
        });
      }
      // Le texte n'est jamais copié dans le journal
      await tx.journalAudit.create({
        data: { utilisateurId: userId, action: 'REMARQUE_ENVOYEE', entite: 'RemarqueParent', entiteId: r.id, details: { longueur: contenu.length } },
      });
      return { id: r.id, date: r.dateCreation };
    });
  }

  async mesRemarques(userId: number) {
    const parentId = await parentIdDe(this.prisma, userId);
    const rows = await this.prisma.remarqueParent.findMany({
      where: { parentId }, orderBy: { id: 'desc' }, take: 50,
      select: { id: true, contenu: true, traitee: true, dateCreation: true },
    });
    return rows.map((r) => ({ id: r.id, contenu: r.contenu, traitee: r.traitee, date: r.dateCreation }));
  }

  // ---------- Direction ----------

  async lister(f: FiltresRemarques) {
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(100, Math.max(1, parseInt(f.taille ?? '25', 10) || 25));
    if (f.traitee && f.traitee !== 'oui' && f.traitee !== 'non') throw new BadRequestException('Filtre invalide.');
    const where = f.traitee ? { traitee: f.traitee === 'oui' } : {};

    const [total, rows] = await Promise.all([
      this.prisma.remarqueParent.count({ where }),
      this.prisma.remarqueParent.findMany({
        where, orderBy: { id: 'desc' }, skip: (page - 1) * taille, take: taille,
        select: {
          id: true, contenu: true, traitee: true, dateCreation: true,
          parent: {
            select: {
              nom: true, prenom: true, telephone: true,
              enfants: { select: { eleve: { select: { prenom: true, nom: true } } } },
            },
          },
        },
      }),
    ]);
    return {
      total, page, taille,
      lignes: rows.map((r) => ({
        id: r.id, contenu: r.contenu, traitee: r.traitee, date: r.dateCreation,
        parent: { nom: r.parent.nom, prenom: r.parent.prenom, telephone: r.parent.telephone },
        enfants: r.parent.enfants.map((e) => `${e.eleve.prenom} ${e.eleve.nom}`),
      })),
    };
  }

  async changerEtat(id: number, traitee: boolean, acteur: Acteur) {
    const r = await this.prisma.remarqueParent.findUnique({
      where: { id },
      select: { id: true, traitee: true, dateCreation: true, parent: { select: { utilisateur: { select: { id: true, actif: true } } } } },
    });
    if (!r) throw new NotFoundException('Remarque introuvable');
    if (r.traitee === traitee) throw new ConflictException(traitee ? 'Cette remarque est déjà traitée.' : "Cette remarque n'est pas traitée.");

    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.remarqueParent.updateMany({ where: { id, traitee: r.traitee }, data: { traitee } });
      if (maj.count === 0) throw new ConflictException("Cette remarque vient d'être modifiée. Actualisez la page.");
      if (traitee && r.parent.utilisateur?.actif) {
        const jour = r.dateCreation.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: ZONE });
        await tx.notification.create({
          data: { utilisateurId: r.parent.utilisateur.id, message: `Votre remarque du ${jour} a été prise en compte par l'école.` },
        });
      }
      await tx.journalAudit.create({
        data: { utilisateurId: acteur.id, action: traitee ? 'REMARQUE_TRAITEE' : 'REMARQUE_ROUVERTE', entite: 'RemarqueParent', entiteId: id, details: {} },
      });
      return { id, traitee };
    });
  }
}
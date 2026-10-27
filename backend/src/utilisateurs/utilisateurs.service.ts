import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { genererMotDePasseTemporaire } from '../auth/politique-mot-de-passe';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';

const BCRYPT_ROUNDS = 12;

// Jamais de motDePasseHash dans une réponse
const SELECT_LISTE = {
  id: true, email: true, role: true, actif: true, doitChangerMotDePasse: true,
  dateCreation: true, derniereConnexion: true, verrouilleJusqua: true, tentativesEchouees: true,
  personnel: true,
  parent: { select: { id: true, nom: true, prenom: true } },
} satisfies Prisma.UtilisateurSelect;

@Injectable()
export class UtilisateursService {
  constructor(private readonly prisma: PrismaService) {}

  roles() {
    return Object.values(RoleUtilisateur);
  }

  lister() {
    return this.prisma.utilisateur.findMany({ select: SELECT_LISTE, orderBy: { email: 'asc' } });
  }

  // Membres du personnel qui n'ont pas encore de compte
  async personnelDisponible() {
    const lies = await this.prisma.utilisateur.findMany({
      where: { personnelId: { not: null } }, select: { personnelId: true },
    });
    return this.prisma.personnel.findMany({
      where: { id: { notIn: lies.map((l) => l.personnelId as number) } },
    });
  }

  private async exigerEmailLibre(email: string, ignorerId?: number) {
    const existant = await this.prisma.utilisateur.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, id: ignorerId ? { not: ignorerId } : undefined },
    });
    if (existant) throw new ConflictException('Un compte existe déjà avec cet email.');
  }

  async creer(dto: CreateUtilisateurDto, adminId?: number) {
    if (dto.role === RoleUtilisateur.PARENT) {
      throw new BadRequestException(
        "Les comptes parents sont créés automatiquement à la validation d'une inscription.",
      );
    }
    const email = dto.email.trim();
    await this.exigerEmailLibre(email);

    if (dto.personnelId) {
      const personnel = await this.prisma.personnel.findUnique({ where: { id: dto.personnelId } });
      if (!personnel) throw new NotFoundException(`Personnel #${dto.personnelId} introuvable`);
      const deja = await this.prisma.utilisateur.findFirst({ where: { personnelId: dto.personnelId } });
      if (deja) throw new ConflictException('Cette personne a déjà un compte.');
    }

    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const motDePasseHash = await bcrypt.hash(motDePasseTemporaire, BCRYPT_ROUNDS);

    try {
      const utilisateur = await this.prisma.$transaction(async (tx) => {
        const u = await tx.utilisateur.create({
          data: {
            email, motDePasseHash, role: dto.role, personnelId: dto.personnelId,
            doitChangerMotDePasse: true,
          },
          select: { id: true, email: true, role: true },
        });
        await tx.journalAudit.create({
          data: {
            utilisateurId: adminId, action: 'UTILISATEUR_CREE', entite: 'Utilisateur', entiteId: u.id,
            details: { email: u.email, role: u.role, personnelId: dto.personnelId ?? null },
          },
        });
        return u;
      });
      // Affiché une seule fois à l'administrateur, jamais journalisé
      return { utilisateur, motDePasseTemporaire };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Un compte existe déjà avec cet email ou pour cette personne.');
      }
      throw e;
    }
  }

  async modifier(id: number, dto: UpdateUtilisateurDto, adminId?: number) {
    const u = await this.exiger(id);

    if (u.role === RoleUtilisateur.PARENT && (dto.role !== undefined || dto.email !== undefined)) {
      throw new BadRequestException("L'email et le rôle d'un compte parent ne se modifient pas ici.");
    }
    if (dto.role === RoleUtilisateur.PARENT) {
      throw new BadRequestException('Le rôle Parent est réservé aux comptes créés par les inscriptions.');
    }
    if (id === adminId && (dto.actif === false || (dto.role && dto.role !== u.role))) {
      throw new ConflictException('Vous ne pouvez pas désactiver votre compte ni changer votre propre rôle.');
    }

    // Toujours conserver au moins un administrateur actif
    const perdAdmin =
      u.role === RoleUtilisateur.ADMIN && u.actif &&
      (dto.actif === false || (dto.role !== undefined && dto.role !== RoleUtilisateur.ADMIN));
    if (perdAdmin) {
      const autres = await this.prisma.utilisateur.count({
        where: { role: RoleUtilisateur.ADMIN, actif: true, id: { not: id } },
      });
      if (autres === 0) throw new ConflictException('Il doit rester au moins un administrateur actif.');
    }

    const email = dto.email?.trim();
    if (email && email.toLowerCase() !== u.email.toLowerCase()) await this.exigerEmailLibre(email, id);

    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.utilisateur.update({
        where: { id },
        data: { email: email ?? undefined, role: dto.role, actif: dto.actif },
        select: SELECT_LISTE,
      });
      await tx.journalAudit.create({
        data: {
          utilisateurId: adminId, action: 'UTILISATEUR_MODIFIE', entite: 'Utilisateur', entiteId: id,
          details: {
            avant: { email: u.email, role: u.role, actif: u.actif },
            apres: { email: maj.email, role: maj.role, actif: maj.actif },
          },
        },
      });
      return maj;
    });
  }

  async reinitialiserMotDePasse(id: number, adminId?: number) {
    const u = await this.exiger(id);
    if (id === adminId) {
      throw new ConflictException('Pour votre propre compte, utilisez « Changer mon mot de passe ».');
    }
    const motDePasseTemporaire = genererMotDePasseTemporaire();
    const motDePasseHash = await bcrypt.hash(motDePasseTemporaire, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.utilisateur.update({
        where: { id },
        data: { motDePasseHash, doitChangerMotDePasse: true, tentativesEchouees: 0, verrouilleJusqua: null },
      }),
      // Déconnecte toutes les sessions ouvertes de l'utilisateur ciblé
      this.prisma.session.updateMany({
        where: { utilisateurId: id, revoquee: false },
        data: { revoquee: true },
      }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: adminId, action: 'MOT_DE_PASSE_REINITIALISE', entite: 'Utilisateur', entiteId: id,
          details: { email: u.email },
        },
      }),
    ]);
    return { email: u.email, motDePasseTemporaire };
  }

  async deverrouiller(id: number, adminId?: number) {
    const u = await this.exiger(id);
    await this.prisma.$transaction([
      this.prisma.utilisateur.update({ where: { id }, data: { tentativesEchouees: 0, verrouilleJusqua: null } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: adminId, action: 'UTILISATEUR_DEVERROUILLE', entite: 'Utilisateur', entiteId: id,
          details: { email: u.email },
        },
      }),
    ]);
    return { message: 'Compte déverrouillé' };
  }

  private async exiger(id: number) {
    const u = await this.prisma.utilisateur.findUnique({ where: { id } });
    if (!u) throw new NotFoundException(`Utilisateur #${id} introuvable`);
    return u;
  }
}
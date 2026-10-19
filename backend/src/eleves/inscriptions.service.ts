import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';

@Injectable()
export class InscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Frères et sœurs = autres élèves qui partagent au moins un parent et sont inscrits (non annulés) cette année
  private async freresInscrits(eleveId: number, anneeScolaireId: number) {
    const liens = await this.prisma.parentEleve.findMany({ where: { eleveId }, select: { parentId: true } });
    if (liens.length === 0) return [];
    return this.prisma.eleve.findMany({
      where: {
        id: { not: eleveId },
        parents: { some: { parentId: { in: liens.map((l) => l.parentId) } } },
        inscriptions: { some: { anneeScolaireId, statut: { not: 'annulee' } } },
      },
      select: { id: true, nom: true, prenom: true },
    });
  }

  // Aperçu affiché avant de confirmer l'inscription
  async apercu(eleveId: number, anneeScolaireId: number) {
    const eleve = await this.prisma.eleve.findUnique({ where: { id: eleveId }, include: { parents: true } });
    if (!eleve) throw new NotFoundException(`Élève #${eleveId} introuvable`);
    const freres = await this.freresInscrits(eleveId, anneeScolaireId);
    return { rangFratrie: freres.length + 1, freres, aDesParents: eleve.parents.length > 0 };
  }

  async creerInscription(dto: CreateInscriptionDto, utilisateurId?: number) {
    const [eleve, annee, niveau, salle] = await Promise.all([
      this.prisma.eleve.findUnique({ where: { id: dto.eleveId } }),
      this.prisma.anneeScolaire.findUnique({ where: { id: dto.anneeScolaireId } }),
      this.prisma.niveau.findUnique({ where: { id: dto.niveauId } }),
      this.prisma.salle.findUnique({ where: { id: dto.salleId }, include: { niveaux: { select: { id: true } } } }),
    ]);
    if (!eleve) throw new NotFoundException(`Élève #${dto.eleveId} introuvable`);
    if (!annee) throw new NotFoundException(`Année scolaire #${dto.anneeScolaireId} introuvable`);
    if (!niveau) throw new NotFoundException(`Niveau #${dto.niveauId} introuvable`);
    if (!salle) throw new NotFoundException(`Salle #${dto.salleId} introuvable`);

    if (!salle.niveaux.some((n) => n.id === niveau.id)) {
      throw new BadRequestException(`La salle ${salle.nom} n'accueille pas le niveau ${niveau.nom}.`);
    }
    if (salle.anneeScolaireId && salle.anneeScolaireId !== annee.id) {
      throw new BadRequestException(`La salle ${salle.nom} n'est pas ouverte pour l'année ${annee.libelle}.`);
    }

    const existante = await this.prisma.inscription.findFirst({
      where: { eleveId: eleve.id, anneeScolaireId: annee.id, statut: { not: 'annulee' } },
    });
    if (existante) {
      throw new ConflictException(
        `${eleve.prenom} ${eleve.nom} est déjà inscrit(e) pour ${annee.libelle} (statut : ${existante.statut}).`,
      );
    }

    const rangFratrie = (await this.freresInscrits(eleve.id, annee.id)).length + 1;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const inscription = await tx.inscription.create({
          data: {
            eleveId: eleve.id, salleId: salle.id, niveauId: niveau.id,
            anneeScolaireId: annee.id, rangFratrie, statut: 'en_attente',
          },
        });
        await tx.journalAudit.create({
          data: {
            utilisateurId, action: 'INSCRIPTION_CREEE', entite: 'Inscription', entiteId: inscription.id,
            details: { eleveId: eleve.id, salleId: salle.id, niveauId: niveau.id, anneeScolaireId: annee.id, rangFratrie },
          },
        });
        return inscription;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Cet élève vient d\'être inscrit pour cette année par un autre utilisateur.');
      }
      throw e;
    }
  }

  listerEnAttente() {
    return this.prisma.inscription.findMany({
      where: { statut: 'en_attente' },
      include: { eleve: true, salle: true, niveau: true, anneeScolaire: true },
      orderBy: { dateInscription: 'asc' },
    });
  }

  // Validation par le Secrétariat, après remise du dossier papier.
  // Crée un compte Parent (email + mot de passe temporaire) à la première validation.
  async valider(inscriptionId: number, utilisateurId?: number) {
    const inscription = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      include: { eleve: { include: { parents: { include: { parent: true } } } } },
    });
    if (!inscription) throw new NotFoundException('Inscription introuvable');
    if (inscription.statut !== 'en_attente') {
      throw new ConflictException(
        `Cette inscription est « ${inscription.statut} » : seule une inscription en attente peut être validée.`,
      );
      
    }

    // Hachage (lent) fait AVANT la transaction pour ne pas la garder ouverte
    const parents = inscription.eleve.parents.map((l) => l.parent);
    const parentsSansEmail = parents.filter((p) => !p.email).length;
    const emailsVus = new Set<string>();
    const comptes: { parentId: number; email: string; motDePasseTemporaire: string; hash: string }[] = [];

    for (const parent of parents) {
      if (!parent.email || emailsVus.has(parent.email)) continue;
      emailsVus.add(parent.email);
      const existant = await this.prisma.utilisateur.findUnique({ where: { email: parent.email } });
      if (existant) continue;
      const motDePasseTemporaire = crypto.randomBytes(6).toString('hex');
      comptes.push({
        parentId: parent.id, email: parent.email, motDePasseTemporaire,
        hash: await bcrypt.hash(motDePasseTemporaire, 12),
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // updateMany avec condition : si quelqu'un a validé entre-temps, count = 0 et on refuse
      const maj = await tx.inscription.updateMany({
        where: { id: inscriptionId, statut: 'en_attente' },
        data: { statut: 'validee' },
      });
      if (maj.count !== 1) throw new ConflictException('Cette inscription vient déjà d\'être traitée.');
            for (const c of comptes) {
        await tx.utilisateur.create({
          data: {
            email: c.email,
            motDePasseHash: c.hash,
            role: RoleUtilisateur.PARENT,
            parentId: c.parentId,
            doitChangerMotDePasse: true,
          },
        });
      }
     
      await tx.journalAudit.create({
        data: {
          utilisateurId, action: 'INSCRIPTION_VALIDEE', entite: 'Inscription', entiteId: inscriptionId,
          // jamais de mot de passe dans le journal
          details: { comptesCreesPourParentIds: comptes.map((c) => c.parentId), parentsSansEmail },
        },
      });
    });

    return {
      statut: 'validee',
      comptesGeneresPourParents: comptes.map(({ email, motDePasseTemporaire }) => ({ email, motDePasseTemporaire })),
      parentsSansEmail,
    };
  }

  async annuler(inscriptionId: number, utilisateurId?: number) {
    const inscription = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      include: { _count: { select: { paiements: true } } },
    });
    if (!inscription) throw new NotFoundException('Inscription introuvable');
    if (inscription.statut === 'annulee') throw new ConflictException('Cette inscription est déjà annulée.');
    if (inscription._count.paiements > 0) {
      throw new ConflictException(
        'Annulation impossible : des paiements sont enregistrés pour cette inscription. Contactez la comptabilité.',
      );
    }

    const [maj] = await this.prisma.$transaction([
      this.prisma.inscription.update({ where: { id: inscriptionId }, data: { statut: 'annulee' } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId, action: 'INSCRIPTION_ANNULEE', entite: 'Inscription', entiteId: inscriptionId,
          details: { statutAvant: inscription.statut },
        },
      }),
    ]);
    return maj;
  }

  async genererFicheInscription(inscriptionId: number) {
    const inscription = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      include: {
        eleve: { include: { parents: { include: { parent: true } } } },
        salle: true,
        niveau: { include: { classe: true } },
        anneeScolaire: true,
      },
    });
    if (!inscription) throw new NotFoundException('Inscription introuvable');
    return inscription;
  }
  async verifierAccesParent(inscriptionId: number, parentId: number) {
  const trouvee = await this.prisma.inscription.findFirst({
    where: { id: inscriptionId, eleve: { parents: { some: { parentId } } } },
    select: { id: true },
  });
  if (!trouvee) throw new NotFoundException('Inscription introuvable');
}
}
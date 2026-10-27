import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AffecterEnseignantDto } from './dto/affecter-enseignant.dto';

// Un enseignant = membre du personnel encore en poste, autorisé à enseigner ou dont le poste le dit
const CANDIDAT: Prisma.PersonnelWhereInput = {
  dateDepart: null,
  OR: [{ autorisationEnseigner: true }, { poste: { contains: 'enseign', mode: 'insensitive' } }],
};

const SELECT_ENSEIGNANT = {
  id: true, matricule: true, nom: true, prenom: true, poste: true,
  salleAffectee: { select: { id: true, nom: true } },
  utilisateur: { select: { role: true, actif: true } },
} satisfies Prisma.PersonnelSelect;

type EnseignantBrut = Prisma.PersonnelGetPayload<{ select: typeof SELECT_ENSEIGNANT }>;

function vue(p: EnseignantBrut) {
  return {
    id: p.id,
    matricule: p.matricule,
    poste: p.poste,
    nom: `${p.prenom} ${p.nom}`,
    salle: p.salleAffectee,
    // sans compte actif de rôle ENSEIGNANT, la personne ne pourra pas se connecter
    compteEnseignant: !!p.utilisateur && p.utilisateur.role === 'ENSEIGNANT' && p.utilisateur.actif,
  };
}

@Injectable()
export class AffectationsService {
  constructor(private readonly prisma: PrismaService) {}

  async salles(): Promise<unknown> {
    const salles = await this.prisma.salle.findMany({
      orderBy: { nom: 'asc' },
      select: {
        id: true, nom: true,
        anneeScolaire: { select: { id: true, libelle: true } },
        niveaux: { select: { id: true, nom: true, classe: { select: { nom: true, ordre: true } } } },
        _count: { select: { inscriptions: true } },
        personnelAffecte: { where: CANDIDAT, select: SELECT_ENSEIGNANT },
      },
    });
    return salles.map((s) => ({
      id: s.id, nom: s.nom, anneeScolaire: s.anneeScolaire, niveaux: s.niveaux,
      inscrits: s._count.inscriptions,
      enseignants: s.personnelAffecte.map(vue),
    }));
  }

  async enseignants(): Promise<unknown> {
    const liste = await this.prisma.personnel.findMany({
      where: CANDIDAT,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      select: SELECT_ENSEIGNANT,
    });
    return liste.map(vue);
  }

  // personnelId = null : retire l'enseignant de la salle. Tout se passe dans une transaction.
  async affecter(acteurId: number, salleId: number, dto: AffecterEnseignantDto): Promise<{ message: string }> {
    return this.prisma.$transaction(async (tx) => {
      const salle = await tx.salle.findUnique({ where: { id: salleId }, select: { id: true, nom: true } });
      if (!salle) throw new NotFoundException('Salle introuvable.');

      const occupants = await tx.personnel.findMany({
        where: { salleAffecteeId: salleId, ...CANDIDAT },
        select: { id: true, nom: true, prenom: true },
      });

      // ----- Retrait -----
      if (dto.personnelId === null) {
        if (occupants.length === 0) throw new BadRequestException("Aucun enseignant n'est affecté à cette salle.");
        await tx.personnel.updateMany({ where: { id: { in: occupants.map((o) => o.id) } }, data: { salleAffecteeId: null } });
        await tx.journalAudit.create({
          data: { utilisateurId: acteurId, action: 'AFFECTATION_RETIREE', entite: 'Salle', entiteId: salleId, details: { salle: salle.nom, avant: occupants.map((o) => o.id) } },
        });
        return { message: 'Enseignant retiré de la salle.' };
      }

      // ----- Affectation -----
      const ens = await tx.personnel.findFirst({
        where: { id: dto.personnelId, ...CANDIDAT },
        select: { id: true, nom: true, prenom: true, salleAffecteeId: true, salleAffectee: { select: { nom: true } } },
      });
      if (!ens) throw new NotFoundException("Enseignant introuvable ou n'est plus en poste.");

      const autres = occupants.filter((o) => o.id !== ens.id);
      if (ens.salleAffecteeId === salleId && autres.length === 0) return { message: 'Cet enseignant est déjà affecté à cette salle.' };

      const ailleurs = ens.salleAffecteeId !== null && ens.salleAffecteeId !== salleId;
      if ((autres.length > 0 || ailleurs) && !dto.remplacer) {
        const raisons: string[] = [];
        if (autres.length > 0) raisons.push(`la salle ${salle.nom} a déjà un enseignant (${autres.map((o) => `${o.prenom} ${o.nom}`).join(', ')})`);
        if (ailleurs) raisons.push(`${ens.prenom} ${ens.nom} est déjà affecté(e) à la salle ${ens.salleAffectee?.nom}`);
        throw new ConflictException(`Confirmation requise : ${raisons.join(' ; ')}.`);
      }

      // On libère d'abord les anciens (l'index unique de la base refuserait deux enseignants dans la salle)
      if (autres.length > 0) await tx.personnel.updateMany({ where: { id: { in: autres.map((o) => o.id) } }, data: { salleAffecteeId: null } });
      await tx.personnel.update({ where: { id: ens.id }, data: { salleAffecteeId: salleId, autorisationEnseigner: true } });
      await tx.journalAudit.create({
        data: {
          utilisateurId: acteurId, action: 'AFFECTATION_ENSEIGNANT', entite: 'Salle', entiteId: salleId,
          details: { salle: salle.nom, avant: autres.map((o) => o.id), apres: ens.id, ancienneSalle: ens.salleAffectee?.nom ?? null },
        },
      });
      return { message: 'Enseignant affecté.' };
    });
  }
}
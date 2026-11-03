import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SuiviDto } from './dto/evaluations.dto';

export interface Acteur { id: number; role: RoleUtilisateur }
type TypeRef = 'domaines' | 'lecons';
// Le cycle de la classe décide du référentiel : prescolaire = domaines/compétences, sinon leçons
const typeDe = (cycle: string): TypeRef => (cycle === 'prescolaire' ? 'domaines' : 'lecons');

export interface Element { id: number; libelle: string; vu?: boolean }
export interface Section { titre: string | null; elements: Element[] }
export interface Groupe { id: number; titre: string; statut?: string | null; sections: Section[] }


@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Contexte et droits ----------

  private async anneeCourante() {
    const maintenant = new Date();
    const annee =
      (await this.prisma.anneeScolaire.findFirst({
        where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } }, select: { id: true },
      })) ?? (await this.prisma.anneeScolaire.findFirst({ orderBy: { dateDebut: 'desc' }, select: { id: true } }));
    if (!annee) throw new BadRequestException('Aucune année scolaire configurée.');
    return annee;
  }

  private async personnelDe(utilisateurId: number) {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId }, select: { personnel: { select: { id: true, salleAffecteeId: true } } },
    });
    return u?.personnel ?? null;
  }

  // Vérifie la salle, le niveau, les droits de l'acteur, et charge les élèves de la classe
  private async contexte(acteur: Acteur, salleId: number, niveauId: number, ecriture: boolean) {
    const salle = await this.prisma.salle.findFirst({
      where: { id: salleId, niveaux: { some: { id: niveauId } } },
      select: {
        id: true, nom: true,
        niveaux: { where: { id: niveauId }, select: { id: true, nom: true, classe: { select: { cycle: true } } } },
      },
    });
    if (!salle) throw new NotFoundException("Cette salle n'accueille pas ce niveau.");

    let personnelId: number | null = null;
    if (acteur.role === RoleUtilisateur.ENSEIGNANT) {
      const p = await this.personnelDe(acteur.id);
      if (!p || p.salleAffecteeId !== salleId) throw new ForbiddenException("Vous ne pouvez accéder qu'à votre salle.");
      personnelId = p.id;
    } else if (ecriture) {
      throw new ForbiddenException("Seul l'enseignant de la salle peut saisir les évaluations.");
    }

    const annee = await this.anneeCourante();
    const inscriptions = await this.prisma.inscription.findMany({
      where: { salleId, niveauId, anneeScolaireId: annee.id, statut: 'validee' },
      orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenom: 'asc' } }],
      select: { id: true, eleve: { select: { nom: true, prenom: true, matricule: true } } },
    });
    const niveau = salle.niveaux[0];
    return { type: typeDe(niveau.classe.cycle), inscriptions, personnelId, salle };
  }

  // ---------- Lecture ----------

  async salles(acteur: Acteur) {
    let where: Prisma.SalleWhereInput = {};
    if (acteur.role === RoleUtilisateur.ENSEIGNANT) {
      const p = await this.personnelDe(acteur.id);
      if (!p?.salleAffecteeId) return [];
      where = { id: p.salleAffecteeId };
    }
    return this.prisma.salle.findMany({
      where, orderBy: { nom: 'asc' },
      select: { id: true, nom: true, niveaux: { orderBy: { ordre: 'asc' }, select: { id: true, nom: true } } },
    });
  }

  async ceintures(acteur: Acteur, salleId: number, niveauId: number) {
    const c = await this.contexte(acteur, salleId, niveauId, false);
    const rows = await this.prisma.ceinture.findMany({
      where: { semestre: { niveauId } },
      orderBy: [{ semestre: { numero: 'asc' } }, { ordre: 'asc' }],
      select: { id: true, nom: true, semestre: { select: { numero: true } } },
    });
    return {
      type: c.type, effectif: c.inscriptions.length,
      ceintures: rows.map((r) => ({ id: r.id, nom: r.nom, semestre: r.semestre.numero })),
    };
  }

  async elements(acteur: Acteur, salleId: number, niveauId: number, ceintureId: number) {
    const c = await this.contexte(acteur, salleId, niveauId, false);
    const ceinture = await this.prisma.ceinture.findFirst({ where: { id: ceintureId, semestre: { niveauId } }, select: { id: true } });
    if (!ceinture) throw new NotFoundException('Ceinture introuvable pour ce niveau.');
    const groupes: Groupe[] = [];

    if (c.type === 'domaines') {
      const domaines = await this.prisma.domaine.findMany({
        where: { ceintureId }, orderBy: { id: 'asc' },
        select: {
          id: true, nom: true,
          competences: { where: { sousDomaineId: null }, orderBy: { id: 'asc' }, select: { id: true, libelle: true } },
          sousDomaines: {
            orderBy: { id: 'asc' },
            select: { id: true, nom: true, competences: { orderBy: { id: 'asc' }, select: { id: true, libelle: true } } },
          },
        },
      });
      const suivis = await this.prisma.progressionDomaine.findMany({
        where: { salleId, domaineId: { in: domaines.map((d) => d.id) } }, select: { domaineId: true, statut: true },
      });
      const statut = new Map(suivis.map((s) => [s.domaineId, s.statut]));
      const el = (x: { id: number; libelle: string }): Element => ({ id: x.id, libelle: x.libelle });

      for (const d of domaines) {
        const sections: Section[] = [];
        if (d.competences.length) sections.push({ titre: null, elements: d.competences.map(el) });
        for (const s of d.sousDomaines) sections.push({ titre: s.nom, elements: s.competences.map(el) });
        groupes.push({ id: d.id, titre: d.nom, statut: statut.get(d.id) ?? null, sections });
      }
    } else {
      const lecons = await this.prisma.lecon.findMany({
        where: { ceintureId, niveauId },
        orderBy: [{ matiereId: 'asc' }, { rubriqueId: 'asc' }, { ordre: 'asc' }, { id: 'asc' }],
        select: { id: true, titre: true, matiere: { select: { id: true, nom: true } }, rubrique: { select: { nom: true } } },
      });
      const ids = lecons.map((l) => l.id);
      const vues = ids.length
        ? await this.prisma.progressionLecon.findMany({ where: { salleId, leconId: { in: ids } }, select: { leconId: true } })
        : [];
      const vuesSet = new Set(vues.map((v) => v.leconId));

      for (const l of lecons) {
        let g = groupes.find((x) => x.id === l.matiere.id);
        if (!g) { g = { id: l.matiere.id, titre: l.matiere.nom, sections: [] }; groupes.push(g); }
        const titre = l.rubrique?.nom ?? null;
        let s = g.sections.find((x) => x.titre === titre);
        if (!s) { s = { titre, elements: [] }; g.sections.push(s); }
        s.elements.push({ id: l.id, libelle: l.titre, vu: vuesSet.has(l.id) });
      }
    }
    return { type: c.type, effectif: c.inscriptions.length, groupes };
  }

  // ---------- Écriture : suivi de classe (vu en classe), jamais de note d'élève ----------

  async suivi(acteur: Acteur, dto: SuiviDto) {
    const c = await this.contexte(acteur, dto.salleId, dto.niveauId, true);
    const enseignantId = c.personnelId as number;

    if (c.type === 'domaines') {
      if (dto.etat === 'vu') throw new BadRequestException("État invalide pour un domaine (« en_cours », « termine » ou « aucun »).");
      const d = await this.prisma.domaine.findFirst({ where: { id: dto.cibleId, ceinture: { semestre: { niveauId: dto.niveauId } } }, select: { id: true, nom: true } });
      if (!d) throw new NotFoundException('Domaine introuvable pour ce niveau.');
      const op =
        dto.etat === 'aucun'
          ? this.prisma.progressionDomaine.deleteMany({ where: { domaineId: d.id, salleId: dto.salleId } })
          : this.prisma.progressionDomaine.upsert({
              where: { domaineId_salleId: { domaineId: d.id, salleId: dto.salleId } },
              create: { domaineId: d.id, salleId: dto.salleId, enseignantId, statut: dto.etat },
              update: { statut: dto.etat, enseignantId, dateMaj: new Date() },
            });
      await this.prisma.$transaction([
        op,
        this.prisma.journalAudit.create({
          data: { utilisateurId: acteur.id, action: 'SUIVI_PEDAGOGIQUE', entite: 'Domaine', entiteId: d.id, details: { salle: c.salle.nom, domaine: d.nom, etat: dto.etat } },
        }),
      ]);
      return { etat: dto.etat };
    }

    if (dto.etat !== 'vu' && dto.etat !== 'aucun') throw new BadRequestException("État invalide pour une leçon (« vu » ou « aucun »).");
    const l = await this.prisma.lecon.findFirst({ where: { id: dto.cibleId, niveauId: dto.niveauId }, select: { id: true, titre: true } });
    if (!l) throw new NotFoundException('Leçon introuvable pour ce niveau.');
    const op =
      dto.etat === 'aucun'
        ? this.prisma.progressionLecon.deleteMany({ where: { leconId: l.id, salleId: dto.salleId } })
        : this.prisma.progressionLecon.upsert({
            where: { leconId_salleId: { leconId: l.id, salleId: dto.salleId } },
            create: { leconId: l.id, salleId: dto.salleId, enseignantId },
            update: {},
          });
    await this.prisma.$transaction([
      op,
      this.prisma.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'SUIVI_PEDAGOGIQUE', entite: 'Lecon', entiteId: l.id, details: { salle: c.salle.nom, lecon: l.titre.slice(0, 120), etat: dto.etat } },
      }),
    ]);
    return { etat: dto.etat };
  }
}
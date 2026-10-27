import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NiveauCompetence, Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaisirEvaluationsDto, SuiviDto } from './dto/evaluations.dto';

export interface Acteur { id: number; role: RoleUtilisateur }
type TypeRef = 'domaines' | 'lecons';
// Le cycle de la classe décide du référentiel : prescolaire = domaines/compétences, sinon leçons
const typeDe = (cycle: string): TypeRef => (cycle === 'prescolaire' ? 'domaines' : 'lecons');

export interface Element { id: number; libelle: string; evalues: number; vu?: boolean }
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
    const inscIds = c.inscriptions.map((i) => i.id);
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
      const compIds = domaines.flatMap((d) => [...d.competences, ...d.sousDomaines.flatMap((s) => s.competences)].map((x) => x.id));
      const [comptes, suivis] = await Promise.all([
        compIds.length
          ? this.prisma.noteCompetence.groupBy({
              by: ['competenceId'], where: { competenceId: { in: compIds }, inscriptionId: { in: inscIds } }, _count: { _all: true },
            })
          : Promise.resolve([]),
        this.prisma.progressionDomaine.findMany({
          where: { salleId, domaineId: { in: domaines.map((d) => d.id) } }, select: { domaineId: true, statut: true },
        }),
      ]);
      const nb = new Map(comptes.map((g) => [g.competenceId, g._count._all]));
      const statut = new Map(suivis.map((s) => [s.domaineId, s.statut]));
      const el = (x: { id: number; libelle: string }): Element => ({ id: x.id, libelle: x.libelle, evalues: nb.get(x.id) ?? 0 });

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
      const [comptes, vues] = await Promise.all([
        ids.length
          ? this.prisma.noteLecon.groupBy({
              by: ['leconId'], where: { leconId: { in: ids }, inscriptionId: { in: inscIds } }, _count: { _all: true },
            })
          : Promise.resolve([]),
        this.prisma.progressionLecon.findMany({ where: { salleId, leconId: { in: ids } }, select: { leconId: true } }),
      ]);
      const nb = new Map(comptes.map((g) => [g.leconId, g._count._all]));
      const vuesSet = new Set(vues.map((v) => v.leconId));

      for (const l of lecons) {
        let g = groupes.find((x) => x.id === l.matiere.id);
        if (!g) { g = { id: l.matiere.id, titre: l.matiere.nom, sections: [] }; groupes.push(g); }
        const titre = l.rubrique?.nom ?? null;
        let s = g.sections.find((x) => x.titre === titre);
        if (!s) { s = { titre, elements: [] }; g.sections.push(s); }
        s.elements.push({ id: l.id, libelle: l.titre, evalues: nb.get(l.id) ?? 0, vu: vuesSet.has(l.id) });
      }
    }
    return { type: c.type, effectif: c.inscriptions.length, groupes };
  }

  private async verifierElement(type: TypeRef, niveauId: number, elementId: number) {
    if (type === 'domaines') {
      const x = await this.prisma.competence.findFirst({
        where: {
          id: elementId,
          OR: [
            { domaine: { ceinture: { semestre: { niveauId } } } },
            { sousDomaine: { domaine: { ceinture: { semestre: { niveauId } } } } },
          ],
        },
        select: { id: true, libelle: true },
      });
      if (!x) throw new NotFoundException('Compétence introuvable pour ce niveau.');
      return { id: x.id, libelle: x.libelle };
    }
    const l = await this.prisma.lecon.findFirst({ where: { id: elementId, niveauId }, select: { id: true, titre: true } });
    if (!l) throw new NotFoundException('Leçon introuvable pour ce niveau.');
    return { id: l.id, libelle: l.titre };
  }

  async eleves(acteur: Acteur, salleId: number, niveauId: number, elementId: number) {
    const c = await this.contexte(acteur, salleId, niveauId, false);
    const element = await this.verifierElement(c.type, niveauId, elementId);
    const inscIds = c.inscriptions.map((i) => i.id);
    const notes =
      c.type === 'domaines'
        ? await this.prisma.noteCompetence.findMany({ where: { competenceId: elementId, inscriptionId: { in: inscIds } }, select: { inscriptionId: true, niveau: true } })
        : await this.prisma.noteLecon.findMany({ where: { leconId: elementId, inscriptionId: { in: inscIds } }, select: { inscriptionId: true, niveau: true } });
    const parInsc = new Map(notes.map((n) => [n.inscriptionId, n.niveau]));
    return {
      element,
      eleves: c.inscriptions.map((i) => ({
        inscriptionId: i.id, nom: i.eleve.nom, prenom: i.eleve.prenom, matricule: i.eleve.matricule,
        niveau: parInsc.get(i.id) ?? null,
      })),
    };
  }

  // ---------- Écriture ----------

  async enregistrer(acteur: Acteur, dto: SaisirEvaluationsDto) {
    const c = await this.contexte(acteur, dto.salleId, dto.niveauId, true);
    const enseignantId = c.personnelId as number;
    const element = await this.verifierElement(c.type, dto.niveauId, dto.elementId);

    const eligibles = new Set(c.inscriptions.map((i) => i.id));
    const vus = new Set<number>();
    for (const n of dto.notes) {
      if (!eligibles.has(n.inscriptionId)) throw new BadRequestException('Certains élèves ne font pas partie de cette classe.');
      if (vus.has(n.inscriptionId)) throw new BadRequestException('Un élève apparaît deux fois dans la saisie.');
      vus.add(n.inscriptionId);
    }

    const ids = dto.notes.map((n) => n.inscriptionId);
    const existantes: { id: number; inscriptionId: number; niveau: NiveauCompetence }[] =
      c.type === 'domaines'
        ? await this.prisma.noteCompetence.findMany({ where: { competenceId: dto.elementId, inscriptionId: { in: ids } }, select: { id: true, inscriptionId: true, niveau: true } })
        : await this.prisma.noteLecon.findMany({ where: { leconId: dto.elementId, inscriptionId: { in: ids } }, select: { id: true, inscriptionId: true, niveau: true } });
    const parInsc = new Map(existantes.map((e) => [e.inscriptionId, e]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let creees = 0, modifiees = 0, retirees = 0;
    for (const n of dto.notes) {
      const ex = parInsc.get(n.inscriptionId);
      if (n.niveau === null) {
        if (!ex) continue;
        retirees++;
        ops.push(c.type === 'domaines' ? this.prisma.noteCompetence.delete({ where: { id: ex.id } }) : this.prisma.noteLecon.delete({ where: { id: ex.id } }));
      } else if (!ex) {
        creees++;
        ops.push(
          c.type === 'domaines'
            ? this.prisma.noteCompetence.create({ data: { inscriptionId: n.inscriptionId, competenceId: dto.elementId, niveau: n.niveau, enseignantId } })
            : this.prisma.noteLecon.create({ data: { inscriptionId: n.inscriptionId, leconId: dto.elementId, niveau: n.niveau, enseignantId } }),
        );
      } else if (ex.niveau !== n.niveau) {
        modifiees++;
        const data = { niveau: n.niveau, enseignantId, dateSaisie: new Date() };
        ops.push(c.type === 'domaines' ? this.prisma.noteCompetence.update({ where: { id: ex.id }, data }) : this.prisma.noteLecon.update({ where: { id: ex.id }, data }));
      }
    }
    if (ops.length === 0) return { creees: 0, modifiees: 0, retirees: 0 };

    ops.push(
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'EVALUATIONS_SAISIES', entite: c.type === 'domaines' ? 'Competence' : 'Lecon',
          entiteId: dto.elementId,
          details: { salle: c.salle.nom, niveauId: dto.niveauId, element: element.libelle.slice(0, 120), creees, modifiees, retirees },
        },
      }),
    );
    await this.prisma.$transaction(ops);
    return { creees, modifiees, retirees };
  }

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
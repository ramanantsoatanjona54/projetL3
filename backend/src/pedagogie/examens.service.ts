import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreerExamenDto, DisciplineExamenDto, ModifierExamenDto, SaisirNotesExamenDto } from './dto/examens.dto';
import type { Acteur } from './evaluations.service';

// Seul ce niveau a des examens blancs (Classe 3, niveau 3)
export const NOM_NIVEAU_EXAMEN = '7e';

const enJour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const valide = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && enJour(iso).toISOString().slice(0, 10) === iso;
const aujourdhui = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); // Madagascar UTC+3
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Moyenne pondérée sur les disciplines notées, sans rang
export function moyennePonderee(disciplines: { id: number; coefficient: number }[], notes: Map<number, number>) {
  let somme = 0, coefs = 0;
  for (const d of disciplines) {
    const n = notes.get(d.id);
    if (n !== undefined) { somme += n * d.coefficient; coefs += d.coefficient; }
  }
  return coefs > 0 ? Math.round((somme / coefs) * 100) / 100 : null;
}

@Injectable()
export class ExamensService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Contexte ----------

  private async niveauExamen() {
    const n = await this.prisma.niveau.findFirst({
      where: { nom: { equals: NOM_NIVEAU_EXAMEN, mode: 'insensitive' } }, select: { id: true, nom: true },
    });
    if (!n) throw new BadRequestException(`Le niveau « ${NOM_NIVEAU_EXAMEN} » est introuvable dans le référentiel.`);
    return n;
  }

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

  private async chargerExamen(id: number) {
    const e = await this.prisma.examenBlanc.findUnique({
      where: { id },
      select: {
        id: true, numero: true, date: true, niveauId: true, anneeScolaireId: true,
        disciplines: { orderBy: { id: 'asc' }, select: { id: true, matiereId: true, coefficient: true, matiere: { select: { nom: true } } } },
      },
    });
    if (!e) throw new NotFoundException('Examen introuvable.');
    return e;
  }

  private async verifierDisciplines(disciplines: DisciplineExamenDto[]) {
    const ids = disciplines.map((d) => d.matiereId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Une même discipline ne peut pas apparaître deux fois.');
    const n = await this.prisma.matiere.count({ where: { id: { in: ids } } });
    if (n !== ids.length) throw new BadRequestException('Une des disciplines est introuvable.');
  }

  private async comptesNotes(disciplineIds: number[]) {
    if (!disciplineIds.length) return new Map<number, number>();
    const g = await this.prisma.noteExamen.groupBy({ by: ['disciplineId'], where: { disciplineId: { in: disciplineIds } }, _count: { _all: true } });
    return new Map(g.map((x) => [x.disciplineId, x._count._all]));
  }

  // ---------- Lecture ----------

  async lister() {
    const niveau = await this.niveauExamen();
    const annee = await this.anneeCourante();
    const examens = await this.prisma.examenBlanc.findMany({
      where: { niveauId: niveau.id, anneeScolaireId: annee.id }, orderBy: { numero: 'asc' },
      select: { id: true, numero: true, date: true, disciplines: { orderBy: { id: 'asc' }, select: { id: true, matiereId: true, coefficient: true, matiere: { select: { nom: true } } } } },
    });
    const nb = await this.comptesNotes(examens.flatMap((e) => e.disciplines.map((d) => d.id)));
    return {
      niveau,
      examens: examens.map((e) => ({
        id: e.id, numero: e.numero, date: iso(e.date),
        totalNotes: e.disciplines.reduce((s, d) => s + (nb.get(d.id) ?? 0), 0),
        disciplines: e.disciplines.map((d) => ({ id: d.id, matiereId: d.matiereId, nom: d.matiere.nom, coefficient: d.coefficient, notes: nb.get(d.id) ?? 0 })),
      })),
    };
  }

  matieres() {
    return this.prisma.matiere.findMany({ orderBy: { nom: 'asc' }, select: { id: true, nom: true } });
  }

  async salles(acteur: Acteur) {
    const niveau = await this.niveauExamen();
    let id: number | undefined;
    if (acteur.role === RoleUtilisateur.ENSEIGNANT) {
      const p = await this.personnelDe(acteur.id);
      if (!p?.salleAffecteeId) return [];
      id = p.salleAffecteeId;
    }
    return this.prisma.salle.findMany({
      where: { niveaux: { some: { id: niveau.id } }, ...(id ? { id } : {}) },
      orderBy: { nom: 'asc' }, select: { id: true, nom: true },
    });
  }

  // Vérifie l'accès à la salle et charge les élèves validés de la 7e
  private async accesSalle(acteur: Acteur, ex: { niveauId: number; anneeScolaireId: number }, salleId: number, ecriture: boolean) {
    const salle = await this.prisma.salle.findFirst({
      where: { id: salleId, niveaux: { some: { id: ex.niveauId } } }, select: { id: true, nom: true },
    });
    if (!salle) throw new NotFoundException("Cette salle n'accueille pas ce niveau.");

    let personnelId: number | null = null;
    if (acteur.role === RoleUtilisateur.ENSEIGNANT) {
      const p = await this.personnelDe(acteur.id);
      if (!p || p.salleAffecteeId !== salleId) throw new ForbiddenException("Vous ne pouvez accéder qu'à votre salle.");
      personnelId = p.id;
    } else if (ecriture) {
      throw new ForbiddenException("Seul l'enseignant de la salle peut saisir les notes.");
    }
    const inscriptions = await this.prisma.inscription.findMany({
      where: { salleId, niveauId: ex.niveauId, anneeScolaireId: ex.anneeScolaireId, statut: 'validee' },
      orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenom: 'asc' } }],
      select: { id: true, eleve: { select: { nom: true, prenom: true, matricule: true } } },
    });
    return { salle, personnelId, inscriptions };
  }

  async detail(acteur: Acteur, examenId: number, salleId: number) {
    const ex = await this.chargerExamen(examenId);
    const c = await this.accesSalle(acteur, ex, salleId, false);
    const disciplines = ex.disciplines.map((d) => ({ id: d.id, nom: d.matiere.nom, coefficient: d.coefficient }));

    const notes = await this.prisma.noteExamen.findMany({
      where: { disciplineId: { in: disciplines.map((d) => d.id) }, inscriptionId: { in: c.inscriptions.map((i) => i.id) } },
      select: { inscriptionId: true, disciplineId: true, note: true },
    });
    const parEleve = new Map<number, Map<number, number>>();
    for (const n of notes) {
      if (!parEleve.has(n.inscriptionId)) parEleve.set(n.inscriptionId, new Map());
      parEleve.get(n.inscriptionId)!.set(n.disciplineId, Number(n.note));
    }

    const eleves = c.inscriptions.map((i) => {
      const m = parEleve.get(i.id) ?? new Map<number, number>();
      const rec: Record<number, number | null> = {};
      disciplines.forEach((d) => { rec[d.id] = m.get(d.id) ?? null; });
      return {
        inscriptionId: i.id, nom: i.eleve.nom, prenom: i.eleve.prenom, matricule: i.eleve.matricule,
        notes: rec, moyenne: moyennePonderee(disciplines, m), complete: m.size === disciplines.length,
      };
    });

    const moyennesDisciplines: Record<number, number | null> = {};
    for (const d of disciplines) {
      const v = eleves.map((e) => e.notes[d.id]).filter((x): x is number => x !== null);
      moyennesDisciplines[d.id] = v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
    }
    const moyennes = eleves.map((e) => e.moyenne).filter((x): x is number => x !== null);

    return {
      examen: { id: ex.id, numero: ex.numero, date: iso(ex.date), disciplines },
      salle: c.salle,
      peutSaisir: acteur.role === RoleUtilisateur.ENSEIGNANT && iso(ex.date) <= aujourdhui(),
      moyenneClasse: moyennes.length ? Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 100) / 100 : null,
      moyennesDisciplines,
      eleves,
    };
  }

  // ---------- Gestion des examens (Direction) ----------

  async creer(acteur: Acteur, dto: CreerExamenDto) {
    if (!valide(dto.date)) throw new BadRequestException('Date invalide.');
    await this.verifierDisciplines(dto.disciplines);
    const niveau = await this.niveauExamen();
    const annee = await this.anneeCourante();
    const dernier = await this.prisma.examenBlanc.aggregate({
      where: { niveauId: niveau.id, anneeScolaireId: annee.id }, _max: { numero: true },
    });
    const numero = (dernier._max.numero ?? 0) + 1;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const e = await tx.examenBlanc.create({
          data: {
            niveauId: niveau.id, anneeScolaireId: annee.id, numero, date: enJour(dto.date),
            disciplines: { create: dto.disciplines.map((d) => ({ matiereId: d.matiereId, coefficient: d.coefficient })) },
          },
          select: { id: true, numero: true },
        });
        await tx.journalAudit.create({
          data: { utilisateurId: acteur.id, action: 'EXAMEN_CREE', entite: 'ExamenBlanc', entiteId: e.id, details: { numero, date: dto.date, disciplines: dto.disciplines.length } },
        });
        return e;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Un autre examen vient d’être créé. Réessayez.');
      }
      throw err;
    }
  }

  async modifier(acteur: Acteur, id: number, dto: ModifierExamenDto) {
    const ex = await this.chargerExamen(id);
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const details: Record<string, unknown> = { numero: ex.numero };

    if (dto.date !== undefined) {
      if (!valide(dto.date)) throw new BadRequestException('Date invalide.');
      ops.push(this.prisma.examenBlanc.update({ where: { id }, data: { date: enJour(dto.date) } }));
      details.date = dto.date;
    }

    if (dto.disciplines) {
      await this.verifierDisciplines(dto.disciplines);
      const nb = await this.comptesNotes(ex.disciplines.map((d) => d.id));
      const demandes = new Map(dto.disciplines.map((d) => [d.matiereId, d.coefficient]));
      const existantes = new Set(ex.disciplines.map((d) => d.matiereId));
      let retirees = 0, ajoutees = 0, coefficients = 0;

      for (const d of ex.disciplines) {
        if (!demandes.has(d.matiereId)) {
          if ((nb.get(d.id) ?? 0) > 0) throw new ConflictException(`La discipline « ${d.matiere.nom} » contient déjà des notes : elle ne peut pas être retirée.`);
          ops.push(this.prisma.examenBlancDiscipline.delete({ where: { id: d.id } }));
          retirees++;
        } else if (demandes.get(d.matiereId) !== d.coefficient) {
          ops.push(this.prisma.examenBlancDiscipline.update({ where: { id: d.id }, data: { coefficient: demandes.get(d.matiereId)! } }));
          coefficients++;
        }
      }
      for (const [matiereId, coefficient] of demandes) {
        if (!existantes.has(matiereId)) {
          ops.push(this.prisma.examenBlancDiscipline.create({ data: { examenBlancId: id, matiereId, coefficient } }));
          ajoutees++;
        }
      }
      Object.assign(details, { disciplinesAjoutees: ajoutees, disciplinesRetirees: retirees, coefficientsModifies: coefficients });
    }

    if (ops.length === 0) return { modifie: false };
    ops.push(this.prisma.journalAudit.create({ data: { utilisateurId: acteur.id, action: 'EXAMEN_MODIFIE', entite: 'ExamenBlanc', entiteId: id, details: details as Prisma.InputJsonValue } }));
    await this.prisma.$transaction(ops);
    return { modifie: true };
  }

  async supprimer(acteur: Acteur, id: number) {
    const ex = await this.chargerExamen(id);
    const nb = await this.comptesNotes(ex.disciplines.map((d) => d.id));
    if ([...nb.values()].some((v) => v > 0)) throw new ConflictException('Cet examen contient des notes : il ne peut pas être supprimé.');
    await this.prisma.$transaction([
      this.prisma.examenBlancDiscipline.deleteMany({ where: { examenBlancId: id } }),
      this.prisma.examenBlanc.delete({ where: { id } }),
      this.prisma.journalAudit.create({ data: { utilisateurId: acteur.id, action: 'EXAMEN_SUPPRIME', entite: 'ExamenBlanc', entiteId: id, details: { numero: ex.numero } } }),
    ]);
    return { supprime: true };
  }

  // ---------- Saisie des notes (enseignant) ----------

  async enregistrerNotes(acteur: Acteur, examenId: number, dto: SaisirNotesExamenDto) {
    const ex = await this.chargerExamen(examenId);
    if (iso(ex.date) > aujourdhui()) throw new BadRequestException("L'examen n'a pas encore eu lieu : la saisie ouvre à sa date.");
    const c = await this.accesSalle(acteur, ex, dto.salleId, true);
    const enseignantId = c.personnelId as number;

    const eligibles = new Set(c.inscriptions.map((i) => i.id));
    const disciplines = new Set(ex.disciplines.map((d) => d.id));
    const vus = new Set<string>();
    for (const n of dto.notes) {
      if (!eligibles.has(n.inscriptionId)) throw new BadRequestException('Certains élèves ne font pas partie de cette classe.');
      if (!disciplines.has(n.disciplineId)) throw new BadRequestException("Une discipline n'appartient pas à cet examen.");
      const k = `${n.inscriptionId}:${n.disciplineId}`;
      if (vus.has(k)) throw new BadRequestException('Une même note apparaît deux fois dans la saisie.');
      vus.add(k);
    }

    const existantes = await this.prisma.noteExamen.findMany({
      where: { disciplineId: { in: [...disciplines] }, inscriptionId: { in: [...eligibles] } },
      select: { id: true, inscriptionId: true, disciplineId: true, note: true },
    });
    const parCle = new Map(existantes.map((e) => [`${e.inscriptionId}:${e.disciplineId}`, e]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let creees = 0, modifiees = 0, retirees = 0;
    for (const n of dto.notes) {
      const ex2 = parCle.get(`${n.inscriptionId}:${n.disciplineId}`);
      if (n.note === null) {
        if (!ex2) continue;
        retirees++;
        ops.push(this.prisma.noteExamen.delete({ where: { id: ex2.id } }));
      } else if (!ex2) {
        creees++;
        ops.push(this.prisma.noteExamen.create({ data: { disciplineId: n.disciplineId, inscriptionId: n.inscriptionId, note: n.note, enseignantId } }));
      } else if (Number(ex2.note) !== n.note) {
        modifiees++;
        ops.push(this.prisma.noteExamen.update({ where: { id: ex2.id }, data: { note: n.note, enseignantId, dateSaisie: new Date() } }));
      }
    }
    if (ops.length === 0) return { creees: 0, modifiees: 0, retirees: 0 };

    ops.push(this.prisma.journalAudit.create({
      data: { utilisateurId: acteur.id, action: 'NOTES_EXAMEN_SAISIES', entite: 'ExamenBlanc', entiteId: examenId, details: { salle: c.salle.nom, numero: ex.numero, creees, modifiees, retirees } },
    }));
    await this.prisma.$transaction(ops);
    return { creees, modifiees, retirees };
  }
}
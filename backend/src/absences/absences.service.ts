import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JustifierAbsenceDto, SaisirAppelDto } from './dto/absences.dto';

const DECALAGE_MS = 3 * 60 * 60 * 1000; // Madagascar : UTC+3
const JOUR_MS = 86_400_000;
const jourLocalIso = () => new Date(Date.now() + DECALAGE_MS).toISOString().slice(0, 10);
const enJour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const estOuvre = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5; // lundi à vendredi
const decaler = (iso: string, n: number) => new Date(enJour(iso).getTime() + n * JOUR_MS).toISOString().slice(0, 10);
const libelleJour = (iso: string) =>
  enJour(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export interface Acteur { id: number; role: RoleUtilisateur }
export interface FiltresAbsences {
  page?: string; taille?: string; salleId?: string; du?: string; au?: string; statut?: string; q?: string;
}

@Injectable()
export class AbsencesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Périmètre : un enseignant ne gère que SA salle ----------

  private async perimetre(acteur: Acteur) {
    if (acteur.role !== RoleUtilisateur.ENSEIGNANT) return { restreint: false, salleId: null as number | null };
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: acteur.id },
      select: { personnel: { select: { salleAffecteeId: true } } },
    });
    return { restreint: true, salleId: u?.personnel?.salleAffecteeId ?? null };
  }

  private async exigerSalle(acteur: Acteur, salleId: number) {
    const p = await this.perimetre(acteur);
    if (p.restreint && p.salleId !== salleId) {
      throw new ForbiddenException('Vous ne pouvez gérer que les absences de votre salle.');
    }
    const salle = await this.prisma.salle.findUnique({ where: { id: salleId }, select: { id: true, nom: true } });
    if (!salle) throw new NotFoundException(`Salle #${salleId} introuvable`);
    return salle;
  }

  async salles(acteur: Acteur) {
    const p = await this.perimetre(acteur);
    if (p.restreint) {
      return p.salleId
        ? this.prisma.salle.findMany({ where: { id: p.salleId }, select: { id: true, nom: true } })
        : [];
    }
    return this.prisma.salle.findMany({ select: { id: true, nom: true }, orderBy: { nom: 'asc' } });
  }

  // ---------- Contrôles de dates ----------

  private exigerJour(iso: string | undefined): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || enJour(iso).toISOString().slice(0, 10) !== iso) {
      throw new BadRequestException('Date invalide (AAAA-MM-JJ).');
    }
    return iso;
  }

  private exigerDateSaisie(iso: string | undefined): string {
    const j = this.exigerJour(iso);
    if (j > jourLocalIso()) throw new BadRequestException('Impossible de saisir une absence dans le futur.');
    return j;
  }

  private async anneePour(iso: string) {
    const d = enJour(iso);
    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { dateDebut: { lte: d }, dateFin: { gte: d } },
      select: { id: true, libelle: true },
    });
    if (!annee) throw new BadRequestException('Aucune année scolaire ne couvre cette date.');
    return annee;
  }

  // ---------- Appel du jour ----------

  async appel(salleId: number, dateIso: string | undefined, acteur: Acteur) {
    const iso = this.exigerDateSaisie(dateIso);
    const salle = await this.exigerSalle(acteur, salleId);
    const jour = enJour(iso);

    if (!estOuvre(jour)) return { salle, date: iso, ouvre: false, anneeScolaire: null, eleves: [] };

    const annee = await this.anneePour(iso);
    const inscriptions = await this.prisma.inscription.findMany({
      where: { salleId, anneeScolaireId: annee.id, statut: 'validee' },
      orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenom: 'asc' } }],
      select: {
        id: true,
        eleve: { select: { nom: true, prenom: true, matricule: true } },
        absences: { where: { date: jour }, select: { id: true, justifiee: true, motif: true } },
      },
    });

    return {
      salle, date: iso, ouvre: true, anneeScolaire: annee,
      eleves: inscriptions.map((i) => ({
        inscriptionId: i.id, nom: i.eleve.nom, prenom: i.eleve.prenom, matricule: i.eleve.matricule,
        absence: i.absences[0] ?? null,
      })),
    };
  }

  async enregistrerAppel(dto: SaisirAppelDto, acteur: Acteur) {
    const iso = this.exigerDateSaisie(dto.date);
    const salle = await this.exigerSalle(acteur, dto.salleId);
    const jour = enJour(iso);
    if (!estOuvre(jour)) throw new BadRequestException('Les absences se saisissent du lundi au vendredi.');
    const annee = await this.anneePour(iso);

    const inscriptions = await this.prisma.inscription.findMany({
      where: { salleId: salle.id, anneeScolaireId: annee.id, statut: 'validee' },
      select: {
        id: true,
        eleve: {
          select: {
            prenom: true,
            parents: { select: { parent: { select: { utilisateur: { select: { id: true, actif: true } } } } } },
          },
        },
        absences: { where: { date: jour }, select: { id: true, justifiee: true } },
      },
    });

    const connus = new Set(inscriptions.map((i) => i.id));
    const demandes = new Set(dto.inscriptionIdsAbsents);
    if ([...demandes].some((id) => !connus.has(id))) {
      throw new BadRequestException('Certains élèves ne font pas partie de cette salle à cette date.');
    }

    const aCreer = inscriptions.filter((i) => demandes.has(i.id) && i.absences.length === 0);
    // Une absence justifiée n'est jamais retirée par l'appel
    const aRetirer = inscriptions.filter((i) => !demandes.has(i.id) && i.absences.length > 0 && !i.absences[0].justifiee);
    const justifieesConservees = inscriptions.filter((i) => i.absences.length > 0 && i.absences[0].justifiee).length;
    const existantes = inscriptions.filter((i) => i.absences.length > 0).length;

    const jourTxt = libelleJour(iso);
    const parents = (i: (typeof inscriptions)[number]) =>
      i.eleve.parents
        .map((p) => p.parent.utilisateur)
        .filter((u): u is { id: number; actif: boolean } => !!u && u.actif)
        .map((u) => u.id);

    const notifications: { utilisateurId: number; message: string }[] = [];
    for (const i of aCreer) {
      for (const utilisateurId of parents(i)) {
        notifications.push({ utilisateurId, message: `${i.eleve.prenom} a été noté(e) absent(e) le ${jourTxt}.` });
      }
    }
    for (const i of aRetirer) {
      for (const utilisateurId of parents(i)) {
        notifications.push({ utilisateurId, message: `Correction : l'absence de ${i.eleve.prenom} du ${jourTxt} a été annulée.` });
      }
    }

    if (aCreer.length > 0 || aRetirer.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        if (aCreer.length > 0) {
          await tx.absence.createMany({
            data: aCreer.map((i) => ({ inscriptionId: i.id, date: jour, justifiee: false, saisiParId: acteur.id })),
            skipDuplicates: true,
          });
        }
        if (aRetirer.length > 0) {
          await tx.absence.deleteMany({
            where: { id: { in: aRetirer.map((i) => i.absences[0].id) }, justifiee: false },
          });
        }
        if (notifications.length > 0) await tx.notification.createMany({ data: notifications });
        await tx.journalAudit.create({
          data: {
            utilisateurId: acteur.id, action: 'ABSENCES_SAISIES', entite: 'Salle', entiteId: salle.id,
            details: {
              salle: salle.nom, date: iso,
              ajoutees: aCreer.map((i) => i.id), retirees: aRetirer.map((i) => i.id),
            },
          },
        });
      });
    }

    return {
      ajoutees: aCreer.length,
      retirees: aRetirer.length,
      justifieesConservees,
      totalAbsents: existantes - aRetirer.length + aCreer.length,
    };
  }

  // ---------- Suivi et justification ----------

  async lister(f: FiltresAbsences, acteur: Acteur) {
    const p = await this.perimetre(acteur);
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(100, Math.max(1, parseInt(f.taille ?? '25', 10) || 25));
    const au = f.au ? this.exigerJour(f.au) : jourLocalIso();
    const du = f.du ? this.exigerJour(f.du) : decaler(au, -30);
    if (du > au) throw new BadRequestException('La date de début doit précéder la date de fin.');

    const salleFiltre = p.restreint ? (p.salleId ?? -1) : f.salleId ? Number(f.salleId) : undefined;
    if (salleFiltre !== undefined && !Number.isInteger(salleFiltre)) throw new BadRequestException('Salle invalide.');

    const q = f.q?.trim();
    const where: Prisma.AbsenceWhereInput = {
      date: { gte: enJour(du), lte: enJour(au) },
      ...(f.statut === 'justifiees' ? { justifiee: true } : f.statut === 'a-justifier' ? { justifiee: false } : {}),
      inscription: {
        ...(salleFiltre !== undefined ? { salleId: salleFiltre } : {}),
        ...(q
          ? {
              eleve: {
                OR: [
                  { nom: { contains: q, mode: 'insensitive' } },
                  { prenom: { contains: q, mode: 'insensitive' } },
                  { matricule: { contains: q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
    };

    const [total, rows] = await Promise.all([
      this.prisma.absence.count({ where }),
      this.prisma.absence.findMany({
        where, orderBy: [{ date: 'desc' }, { id: 'desc' }], skip: (page - 1) * taille, take: taille,
        include: {
          inscription: {
            select: { id: true, salle: { select: { nom: true } }, eleve: { select: { id: true, nom: true, prenom: true, matricule: true } } },
          },
          saisiPar: { select: { email: true } },
        },
      }),
    ]);

    return {
      total, page, taille,
      lignes: rows.map((a) => ({
        id: a.id, date: a.date, justifiee: a.justifiee, motif: a.motif,
        inscriptionId: a.inscription.id, eleve: a.inscription.eleve, salle: a.inscription.salle.nom,
        saisiPar: a.saisiPar?.email ?? null,
      })),
    };
  }

  async justifier(id: number, dto: JustifierAbsenceDto, acteur: Acteur) {
    const a = await this.exiger(id);
    if (a.justifiee) throw new ConflictException('Cette absence est déjà justifiée.');
    const motif = dto.motif.trim();
    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.absence.update({ where: { id }, data: { justifiee: true, motif } });
      await tx.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'ABSENCE_JUSTIFIEE', entite: 'Absence', entiteId: id,
          details: { inscriptionId: a.inscriptionId, date: a.date.toISOString().slice(0, 10), motif },
        },
      });
      return maj;
    });
  }

  async annulerJustification(id: number, acteur: Acteur) {
    const a = await this.exiger(id);
    if (!a.justifiee) throw new ConflictException("Cette absence n'est pas justifiée.");
    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.absence.update({ where: { id }, data: { justifiee: false, motif: null } });
      await tx.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'ABSENCE_JUSTIFICATION_ANNULEE', entite: 'Absence', entiteId: id,
          details: { inscriptionId: a.inscriptionId, date: a.date.toISOString().slice(0, 10), ancienMotif: a.motif },
        },
      });
      return maj;
    });
  }

  // ---------- Vue parent (le contrôle d'appartenance est fait par le contrôleur) ----------

  async absencesPourParent(inscriptionId: number) {
    const ins = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      select: {
        eleve: { select: { prenom: true, nom: true } },
        salle: { select: { nom: true } },
        anneeScolaire: { select: { libelle: true } },
      },
    });
    if (!ins) throw new NotFoundException('Inscription introuvable');
    const absences = await this.prisma.absence.findMany({
      where: { inscriptionId }, orderBy: { date: 'desc' },
      select: { id: true, date: true, justifiee: true, motif: true },
    });
    return {
      eleve: ins.eleve, salle: ins.salle.nom, anneeScolaire: ins.anneeScolaire.libelle,
      total: absences.length,
      justifiees: absences.filter((a) => a.justifiee).length,
      nonJustifiees: absences.filter((a) => !a.justifiee).length,
      absences,
    };
  }

  private async exiger(id: number) {
    const a = await this.prisma.absence.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Absence #${id} introuvable`);
    return a;
  }
}
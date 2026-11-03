import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NiveauCompetence, Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppreciationDto, PublicationClasseDto, PublicationDto, SaisirBulletinDto } from './dto/bulletins.dto';
import { EvaluationsService } from './evaluations.service';
import type { Acteur } from './evaluations.service';
import { NOM_NIVEAU_EXAMEN } from './examens.service';

const periode = (n: number) => `Semestre ${n}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const aujourdhui = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); // UTC+3
const lendemain = (d: Date) => new Date(d.getTime() + 24 * 3600 * 1000);
const arrondi = (x: number) => Math.round(x * 100) / 100;

// Seuil de la mention « résultat à l'examen : OUI » (moyenne pondérée sur 20). À confirmer par la Direction.
export const SEUIL_RESULTAT_EXAMEN = 10;

const INSC_SELECT = {
  id: true, salleId: true, niveauId: true, anneeScolaireId: true, statut: true, eleveId: true,
  eleve: { select: { nom: true, prenom: true, matricule: true, dateNaissance: true } },
  salle: { select: { nom: true } },
  niveau: { select: { nom: true, classe: { select: { cycle: true } } } },
  anneeScolaire: { select: { libelle: true, dateFin: true } },
} satisfies Prisma.InscriptionSelect;

type InscCtx = Prisma.InscriptionGetPayload<{ select: typeof INSC_SELECT }>;

// Contenu du bulletin : discipline > rubrique (titre nul = lignes directement sous la discipline) > ligne
interface LigneB { id: number; libelle: string; niveau: NiveauCompetence | null; archive: boolean }
interface RubriqueB { id: number | null; titre: string | null; lignes: LigneB[] }
interface DisciplineB { id: number; titre: string; rubriques: RubriqueB[] }

// Suivi « vu en classe » montré aux parents (jamais de note)
interface ItemP { libelle: string; vu: boolean | null }
interface SectionP { titre: string | null; items: ItemP[] }
interface GroupeP { titre: string; statut: 'aucun' | 'en_cours' | 'termine' | null; sections: SectionP[] }
interface CeintureP { nom: string; groupes: GroupeP[] }

@Injectable()
export class BulletinsService {
  constructor(private readonly prisma: PrismaService, private readonly evaluations: EvaluationsService) {}

  // ---------- Contexte et droits ----------

  private async anneeCourante() {
    const maintenant = new Date();
    const annee =
      (await this.prisma.anneeScolaire.findFirst({
        where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } }, select: { id: true, dateFin: true },
      })) ?? (await this.prisma.anneeScolaire.findFirst({ orderBy: { dateDebut: 'desc' }, select: { id: true, dateFin: true } }));
    if (!annee) throw new BadRequestException('Aucune année scolaire configurée.');
    return annee;
  }

  private async personnelDe(utilisateurId: number) {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId }, select: { personnel: { select: { id: true, salleAffecteeId: true } } },
    });
    return u?.personnel ?? null;
  }

  private async salleAffectee(utilisateurId: number) {
    return (await this.personnelDe(utilisateurId))?.salleAffecteeId ?? null;
  }

  private async inscriptionStaff(acteur: Acteur, inscriptionId: number): Promise<InscCtx> {
    const insc = await this.prisma.inscription.findUnique({ where: { id: inscriptionId }, select: INSC_SELECT });
    if (!insc || insc.statut !== 'validee') throw new NotFoundException('Inscription introuvable.');
    if (acteur.role === RoleUtilisateur.ENSEIGNANT && (await this.salleAffectee(acteur.id)) !== insc.salleId) {
      throw new ForbiddenException("Cet élève n'est pas dans votre salle.");
    }
    return insc;
  }

  // Parent : uniquement les enfants rattachés à son compte ; sinon 404 (rien n'est révélé)
  private async inscriptionParent(utilisateurId: number, inscriptionId: number): Promise<InscCtx> {
    const u = await this.prisma.utilisateur.findUnique({ where: { id: utilisateurId }, select: { parentId: true } });
    if (!u?.parentId) throw new NotFoundException('Inscription introuvable.');
    const insc = await this.prisma.inscription.findFirst({
      where: { id: inscriptionId, statut: 'validee', eleve: { parents: { some: { parentId: u.parentId } } } },
      select: INSC_SELECT,
    });
    if (!insc) throw new NotFoundException('Inscription introuvable.');
    return insc;
  }

  private async verifierSemestre(niveauId: number, numero: number) {
    const s = await this.prisma.semestre.findUnique({ where: { niveauId_numero: { niveauId, numero } }, select: { id: true } });
    if (!s) throw new NotFoundException("Ce semestre n'existe pas pour ce niveau.");
    return s;
  }

  // ---------- Avancement : « complet » = chaque ligne exigée du semestre est évaluée ----------

  // Lignes exigées : non archivées et créées avant la fin de l'année de l'élève
  private filtreExigees(semestreId: number, anneeFin: Date) {
    return { semestreId, type: 'LIGNE' as const, archiveLe: null, creeLe: { lt: lendemain(anneeFin) } };
  }

  private async avancements(inscriptionIds: number[], semestreId: number, anneeFin: Date) {
    const filtre = this.filtreExigees(semestreId, anneeFin);
    const total = await this.prisma.elementBulletin.count({ where: filtre });
    const groupes = inscriptionIds.length
      ? await this.prisma.evaluationBulletin.groupBy({
          by: ['inscriptionId'], where: { inscriptionId: { in: inscriptionIds }, element: filtre }, _count: { _all: true },
        })
      : [];
    const parId = new Map(groupes.map((g) => [g.inscriptionId, g._count._all]));
    return {
      total,
      de: (id: number) => {
        const evalue = parId.get(id) ?? 0;
        return { evalue, total, complet: total > 0 && evalue >= total };
      },
    };
  }

  private raisonIncomplet(evalue: number, total: number) {
    if (total === 0) return "Le contenu du bulletin n'est pas défini pour ce niveau : l'administrateur doit le renseigner (menu « Contenu du bulletin »).";
    return `Bulletin incomplet : ${total - evalue} ligne(s) restent à évaluer sur ${total}.`;
  }

  // ---------- Construction du bulletin (calculé, jamais recopié) ----------

  private async construire(insc: InscCtx, numero: number) {
    const semestre = await this.verifierSemestre(insc.niveauId, numero);

    const elements = await this.prisma.elementBulletin.findMany({
      where: { semestreId: semestre.id, creeLe: { lt: lendemain(insc.anneeScolaire.dateFin) } },
      orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
      select: { id: true, parentId: true, type: true, libelle: true, archiveLe: true },
    });
    const evals = await this.prisma.evaluationBulletin.findMany({
      where: { inscriptionId: insc.id, element: { semestreId: semestre.id } }, select: { elementId: true, niveau: true },
    });
    const parId = new Map(evals.map((e) => [e.elementId, e.niveau]));

    // Une ligne archivée reste visible seulement si cet élève a été évalué dessus
    const lignes = elements.filter((e) => e.type === 'LIGNE' && (e.archiveLe === null || parId.has(e.id)));
    const visibles = new Set(lignes.map((l) => l.id));
    const enfantsDe = (id: number | null) => elements.filter((e) => e.parentId === id);
    const ligne = (e: (typeof elements)[number]): LigneB => ({ id: e.id, libelle: e.libelle, niveau: parId.get(e.id) ?? null, archive: e.archiveLe !== null });

    const disciplines: DisciplineB[] = [];
    for (const d of enfantsDe(null).filter((e) => e.type === 'DISCIPLINE')) {
      const rubriques: RubriqueB[] = [];
      for (const c of enfantsDe(d.id)) {
        if (c.type === 'LIGNE') {
          if (!visibles.has(c.id)) continue;
          const derniere = rubriques[rubriques.length - 1];
          if (derniere && derniere.titre === null) derniere.lignes.push(ligne(c));
          else rubriques.push({ id: null, titre: null, lignes: [ligne(c)] });
        } else if (c.type === 'RUBRIQUE') {
          const ls = enfantsDe(c.id).filter((l) => l.type === 'LIGNE' && visibles.has(l.id)).map(ligne);
          if (ls.length) rubriques.push({ id: c.id, titre: c.libelle, lignes: ls });
        }
      }
      if (rubriques.length) disciplines.push({ id: d.id, titre: d.libelle, rubriques });
    }

    const resume = { A: 0, EA: 0, AR: 0, NA: 0, nonEvalue: 0 };
    let exigees = 0, evaluees = 0;
    for (const l of lignes) {
      const n = parId.get(l.id);
      if (n) resume[n]++; else resume.nonEvalue++;
      if (l.archiveLe === null) { exigees++; if (n) evaluees++; }
    }
    const progression = { evalue: evaluees, total: exigees, complet: exigees > 0 && evaluees === exigees };

    // 7e : les examens blancs forment un document à part (voir voirExamen) ; ici seulement la liste de ceux déjà passés
    const examens = insc.niveau.nom.toLowerCase() === NOM_NIVEAU_EXAMEN.toLowerCase() ? await this.indexExamens(insc, false) : null;

    const b = await this.prisma.bulletin.findUnique({
      where: { inscriptionId_periode: { inscriptionId: insc.id, periode: periode(numero) } },
      select: { appreciationGenerale: true, publie: true, datePublication: true },
    });

    return {
      inscriptionId: insc.id,
      eleve: { nom: insc.eleve.nom, prenom: insc.eleve.prenom, matricule: insc.eleve.matricule, dateNaissance: iso(insc.eleve.dateNaissance) },
      salle: insc.salle.nom, niveau: insc.niveau.nom, annee: insc.anneeScolaire.libelle, semestre: numero,
      disciplines, resume, progression, examens,
      appreciation: b?.appreciationGenerale ?? null,
      publie: b?.publie ?? false,
      datePublication: b?.datePublication ? b.datePublication.toISOString() : null,
    };
  }

  // ---------- Examens blancs (7e) : un document par examen ----------

  private async chargerExamens(insc: InscCtx, numero?: number) {
    return this.prisma.examenBlanc.findMany({
      where: {
        niveauId: insc.niveauId, anneeScolaireId: insc.anneeScolaireId,
        date: { lte: new Date(`${aujourdhui()}T00:00:00.000Z`) }, ...(numero !== undefined ? { numero } : {}),
      },
      orderBy: { numero: 'asc' },
      select: { id: true, numero: true, date: true, disciplines: { orderBy: { id: 'asc' }, select: { id: true, coefficient: true, matiere: { select: { nom: true } } } } },
    });
  }

  // Liste des examens passés ; pour un parent, seulement ceux dont toutes les notes de l'enfant sont saisies
  private async indexExamens(insc: InscCtx, pourParent: boolean) {
    const exs = await this.chargerExamens(insc);
    const ids = exs.flatMap((e) => e.disciplines.map((d) => d.id));
    const notes = ids.length
      ? await this.prisma.noteExamen.findMany({ where: { inscriptionId: insc.id, disciplineId: { in: ids } }, select: { disciplineId: true } })
      : [];
    const avec = new Set(notes.map((n) => n.disciplineId));
    const liste = exs.map((e) => ({
      numero: e.numero, date: iso(e.date),
      complet: e.disciplines.length > 0 && e.disciplines.every((d) => avec.has(d.id)),
    }));
    return pourParent ? liste.filter((x) => x.complet) : liste;
  }

  private async documentExamen(insc: InscCtx, numero: number, pourParent: boolean) {
    const [ex] = await this.chargerExamens(insc, numero);
    if (!ex) throw new NotFoundException("Cet examen n'est pas disponible.");
    const notes = await this.prisma.noteExamen.findMany({
      where: { inscriptionId: insc.id, disciplineId: { in: ex.disciplines.map((d) => d.id) } }, select: { disciplineId: true, note: true },
    });
    const parDiscipline = new Map(notes.map((n) => [n.disciplineId, Number(n.note)]));
    const complet = ex.disciplines.length > 0 && ex.disciplines.every((d) => parDiscipline.has(d.id));
    if (pourParent && !complet) throw new NotFoundException("Cet examen n'est pas disponible.");

    const lignes = ex.disciplines.map((d) => {
      const note = parDiscipline.get(d.id) ?? null;
      return { discipline: d.matiere.nom, coefficient: d.coefficient, note, pondere: note === null ? null : arrondi(note * d.coefficient) };
    });
    const notees = lignes.filter((l) => l.note !== null);
    const totalCoef = lignes.reduce((s, l) => s + l.coefficient, 0);
    const totalNotes = arrondi(notees.reduce((s, l) => s + (l.note as number), 0));
    const totalPondere = arrondi(notees.reduce((s, l) => s + (l.pondere as number), 0));
    // Moyennes calculées seulement quand toutes les notes sont saisies
    const moyenneSimple = complet ? arrondi(totalNotes / lignes.length) : null;
    const moyennePond = complet && totalCoef > 0 ? arrondi(totalPondere / totalCoef) : null;

    const [prof, dir] = await Promise.all([
      this.prisma.personnel.findFirst({ where: { salleAffecteeId: insc.salleId }, orderBy: { id: 'asc' }, select: { nom: true, prenom: true } }),
      this.prisma.utilisateur.findFirst({ where: { role: RoleUtilisateur.DIRECTRICE, actif: true }, orderBy: { id: 'asc' }, select: { personnel: { select: { nom: true, prenom: true } } } }),
    ]);
    const signature = (x: { nom: string; prenom: string } | null | undefined) => (x ? `${x.prenom.trim().charAt(0).toUpperCase()}. ${x.nom.toUpperCase()}` : null);

    return {
      inscriptionId: insc.id,
      eleve: { nom: insc.eleve.nom, prenom: insc.eleve.prenom, matricule: insc.eleve.matricule },
      salle: insc.salle.nom, niveau: insc.niveau.nom, annee: insc.anneeScolaire.libelle,
      numero, date: iso(ex.date), lignes, complet,
      totaux: { coefficients: totalCoef, notes: complet ? totalNotes : null, pondere: complet ? totalPondere : null },
      moyenneSimple, moyennePonderee: moyennePond,
      resultat: moyennePond === null ? null : moyennePond >= SEUIL_RESULTAT_EXAMEN ? ('OUI' as const) : ('NON' as const),
      enseignant: signature(prof), directrice: signature(dir?.personnel),
    };
  }

  private verifierNiveauExamen(insc: InscCtx) {
    if (insc.niveau.nom.toLowerCase() !== NOM_NIVEAU_EXAMEN.toLowerCase()) throw new NotFoundException("Ce niveau n'a pas d'examens blancs.");
  }

  async voirExamen(acteur: Acteur, inscriptionId: number, numero: number) {
    const insc = await this.inscriptionStaff(acteur, inscriptionId);
    this.verifierNiveauExamen(insc);
    return this.documentExamen(insc, numero, false);
  }

  async examensParent(utilisateurId: number, inscriptionId: number) {
    const insc = await this.inscriptionParent(utilisateurId, inscriptionId);
    if (insc.niveau.nom.toLowerCase() !== NOM_NIVEAU_EXAMEN.toLowerCase()) return [];
    return this.indexExamens(insc, true);
  }

  async voirExamenParent(utilisateurId: number, inscriptionId: number, numero: number) {
    const insc = await this.inscriptionParent(utilisateurId, inscriptionId);
    this.verifierNiveauExamen(insc);
    return this.documentExamen(insc, numero, true);
  }

  // ---------- Personnel ----------

  salles(acteur: Acteur) { return this.evaluations.salles(acteur); }

  async classe(acteur: Acteur, salleId: number, niveauId: number, numero: number, anneeId?: number) {
    if (numero !== 1 && numero !== 2) throw new BadRequestException('Semestre invalide.');
    const salle = await this.prisma.salle.findFirst({ where: { id: salleId, niveaux: { some: { id: niveauId } } }, select: { id: true, nom: true } });
    if (!salle) throw new NotFoundException("Cette salle n'accueille pas ce niveau.");
    if (acteur.role === RoleUtilisateur.ENSEIGNANT && (await this.salleAffectee(acteur.id)) !== salleId) {
      throw new ForbiddenException('Vous ne pouvez accéder qu’à votre salle.');
    }
    const semestre = await this.verifierSemestre(niveauId, numero);

    let annee: { id: number; dateFin: Date };
    if (anneeId !== undefined) {
      if (!Number.isInteger(anneeId)) throw new BadRequestException('Année invalide.');
      if (acteur.role === RoleUtilisateur.ENSEIGNANT) throw new ForbiddenException('Seule la Direction consulte les années précédentes.');
      const a = await this.prisma.anneeScolaire.findUnique({ where: { id: anneeId }, select: { id: true, dateFin: true } });
      if (!a) throw new NotFoundException('Année scolaire introuvable.');
      annee = a;
    } else {
      annee = await this.anneeCourante();
    }

    const inscriptions = await this.prisma.inscription.findMany({
      where: { salleId, niveauId, anneeScolaireId: annee.id, statut: 'validee' },
      orderBy: [{ eleve: { nom: 'asc' } }, { eleve: { prenom: 'asc' } }],
      select: { id: true, eleve: { select: { nom: true, prenom: true, matricule: true } } },
    });
    const bulletins = await this.prisma.bulletin.findMany({
      where: { inscriptionId: { in: inscriptions.map((i) => i.id) }, periode: periode(numero) },
      select: { inscriptionId: true, appreciationGenerale: true, publie: true },
    });
    const parId = new Map(bulletins.map((b) => [b.inscriptionId, b]));
    const av = await this.avancements(inscriptions.map((i) => i.id), semestre.id, annee.dateFin);
    return {
      salle, total: av.total,
      eleves: inscriptions.map((i) => ({
        inscriptionId: i.id, nom: i.eleve.nom, prenom: i.eleve.prenom, matricule: i.eleve.matricule,
        aAppreciation: !!parId.get(i.id)?.appreciationGenerale, publie: parId.get(i.id)?.publie ?? false,
        evalue: av.de(i.id).evalue, total: av.total, complet: av.de(i.id).complet,
      })),
    };
  }

  async voir(acteur: Acteur, inscriptionId: number, numero: number) {
    if (numero !== 1 && numero !== 2) throw new BadRequestException('Semestre invalide.');
    return this.construire(await this.inscriptionStaff(acteur, inscriptionId), numero);
  }

  // Saisie des évaluations du bulletin : l'enseignante de la salle, année en cours, lignes exigées uniquement
  async saisir(acteur: Acteur, inscriptionId: number, dto: SaisirBulletinDto) {
    if (acteur.role !== RoleUtilisateur.ENSEIGNANT) throw new ForbiddenException("Seule l'enseignante de la salle saisit les évaluations.");
    const insc = await this.inscriptionStaff(acteur, inscriptionId);
    if (insc.anneeScolaireId !== (await this.anneeCourante()).id) throw new BadRequestException("Seuls les bulletins de l'année en cours sont modifiables.");
    const semestre = await this.verifierSemestre(insc.niveauId, dto.semestre);
    const personnel = await this.personnelDe(acteur.id);
    if (!personnel) throw new ForbiddenException("Aucune fiche de personnel n'est liée à ce compte.");

    const ids = dto.notes.map((n) => n.elementId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Une ligne apparaît deux fois dans la saisie.');
    const lignes = await this.prisma.elementBulletin.count({ where: { id: { in: ids }, ...this.filtreExigees(semestre.id, insc.anneeScolaire.dateFin) } });
    if (lignes !== ids.length) throw new BadRequestException('Certaines lignes ne font pas partie du bulletin de ce semestre.');

    const existantes = await this.prisma.evaluationBulletin.findMany({
      where: { inscriptionId, elementId: { in: ids } }, select: { id: true, elementId: true, niveau: true },
    });
    const parLigne = new Map(existantes.map((e) => [e.elementId, e]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let creees = 0, modifiees = 0, retirees = 0;
    for (const n of dto.notes) {
      const ex = parLigne.get(n.elementId);
      if (n.niveau === null) {
        if (!ex) continue;
        retirees++;
        ops.push(this.prisma.evaluationBulletin.delete({ where: { id: ex.id } }));
      } else if (!ex) {
        creees++;
        ops.push(this.prisma.evaluationBulletin.create({ data: { inscriptionId, elementId: n.elementId, niveau: n.niveau, enseignantId: personnel.id } }));
      } else if (ex.niveau !== n.niveau) {
        modifiees++;
        ops.push(this.prisma.evaluationBulletin.update({ where: { id: ex.id }, data: { niveau: n.niveau, enseignantId: personnel.id, dateSaisie: new Date() } }));
      }
    }

    if (ops.length > 0) {
      const bulletin = await this.prisma.bulletin.findUnique({
        where: { inscriptionId_periode: { inscriptionId, periode: periode(dto.semestre) } }, select: { publie: true },
      });
      ops.push(this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action: 'EVALUATIONS_BULLETIN_SAISIES', entite: 'Inscription', entiteId: inscriptionId,
          details: { semestre: dto.semestre, creees, modifiees, retirees, apresPublication: bulletin?.publie ?? false },
        },
      }));
      await this.prisma.$transaction(ops);
    }

    const av = await this.avancements([inscriptionId], semestre.id, insc.anneeScolaire.dateFin);
    return { creees, modifiees, retirees, progression: av.de(inscriptionId) };
  }

  async appreciation(acteur: Acteur, inscriptionId: number, dto: AppreciationDto) {
    const insc = await this.inscriptionStaff(acteur, inscriptionId);
    if (insc.anneeScolaireId !== (await this.anneeCourante()).id) throw new BadRequestException("Seuls les bulletins de l'année en cours sont modifiables.");
    await this.verifierSemestre(insc.niveauId, dto.semestre);

    const where = { inscriptionId_periode: { inscriptionId, periode: periode(dto.semestre) } };
    const existant = await this.prisma.bulletin.findUnique({ where, select: { publie: true } });

    const texte = dto.appreciation.trim() || null;
    await this.prisma.$transaction([
      this.prisma.bulletin.upsert({
        where,
        create: { inscriptionId, periode: periode(dto.semestre), appreciationGenerale: texte },
        update: { appreciationGenerale: texte },
      }),
      this.prisma.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'APPRECIATION_BULLETIN', entite: 'Bulletin', entiteId: inscriptionId, details: { semestre: dto.semestre, longueur: texte?.length ?? 0, apresPublication: existant?.publie ?? false } },
      }),
    ]);
    return { enregistre: true };
  }

  async publier(acteur: Acteur, inscriptionId: number, dto: PublicationDto) {
    const insc = await this.inscriptionStaff(acteur, inscriptionId);
    const semestre = await this.verifierSemestre(insc.niveauId, dto.semestre);
    const b = await this.prisma.bulletin.findUnique({
      where: { inscriptionId_periode: { inscriptionId, periode: periode(dto.semestre) } },
      select: { id: true, appreciationGenerale: true, publie: true },
    });

    if (dto.publie) {
      if (b?.publie) return { publie: true, parentsPrevenus: 0 };
      // Règle de l'école : un bulletin n'est publié que complet (toutes les lignes évaluées) ET avec son appréciation
      const av = (await this.avancements([inscriptionId], semestre.id, insc.anneeScolaire.dateFin)).de(inscriptionId);
      if (!av.complet) throw new BadRequestException(this.raisonIncomplet(av.evalue, av.total));
      if (!b?.appreciationGenerale) throw new BadRequestException("Rédigez l'appréciation générale avant de publier.");
    } else if (!b || !b.publie) {
      return { publie: false, parentsPrevenus: 0 };
    }
    const bulletinId = b!.id;
    const notifications = dto.publie ? await this.messagesParents([inscriptionId], dto.semestre) : [];

    let prevenus = 0;
    await this.prisma.$transaction(async (tx) => {
      // Conditionnel : si quelqu'un vient de changer l'état, on ne notifie pas en double
      const r = await tx.bulletin.updateMany({
        where: { id: bulletinId, publie: !dto.publie },
        data: dto.publie ? { publie: true, datePublication: new Date() } : { publie: false, datePublication: null },
      });
      if (r.count === 0) return;
      await tx.journalAudit.create({
        data: { utilisateurId: acteur.id, action: dto.publie ? 'BULLETIN_PUBLIE' : 'BULLETIN_DEPUBLIE', entite: 'Bulletin', entiteId: inscriptionId, details: { semestre: dto.semestre } },
      });
      if (notifications.length > 0) {
        await tx.notification.createMany({ data: notifications });
        prevenus = notifications.length;
      }
    });
    return { publie: dto.publie, parentsPrevenus: prevenus };
  }

  async publierClasse(acteur: Acteur, dto: PublicationClasseDto) {
    const c = await this.classe(acteur, dto.salleId, dto.niveauId, dto.semestre); // année en cours
    const ids = c.eleves.map((e) => e.inscriptionId);
    const apprecies = await this.prisma.bulletin.findMany({
      where: { inscriptionId: { in: ids }, periode: periode(dto.semestre), publie: false, appreciationGenerale: { not: null } },
      select: { id: true, inscriptionId: true },
    });
    const complets = new Set(c.eleves.filter((e) => e.complet).map((e) => e.inscriptionId));
    const aPublier = apprecies.filter((x) => complets.has(x.inscriptionId));

    const nonPublies = c.eleves.filter((e) => !e.publie);
    const incomplets = nonPublies.filter((e) => !e.complet).length;
    const sansAppreciation = nonPublies.filter((e) => e.complet && !e.aAppreciation).length;

    let prevenus = 0;
    if (aPublier.length > 0) {
      const notifications = await this.messagesParents(aPublier.map((x) => x.inscriptionId), dto.semestre);
      const ops: Prisma.PrismaPromise<unknown>[] = [
        this.prisma.bulletin.updateMany({ where: { id: { in: aPublier.map((x) => x.id) }, publie: false }, data: { publie: true, datePublication: new Date() } }),
        this.prisma.journalAudit.create({
          data: { utilisateurId: acteur.id, action: 'BULLETINS_PUBLIES_CLASSE', entite: 'Salle', entiteId: dto.salleId, details: { semestre: dto.semestre, publies: aPublier.length, incomplets, sansAppreciation, parentsPrevenus: notifications.length } },
        }),
      ];
      if (notifications.length > 0) ops.push(this.prisma.notification.createMany({ data: notifications }));
      await this.prisma.$transaction(ops);
      prevenus = notifications.length;
    }
    return { publies: aPublier.length, incomplets, sansAppreciation, parentsPrevenus: prevenus };
  }

  // ---------- Parent : uniquement les bulletins publiés de ses enfants ----------

  async semestresParent(utilisateurId: number, inscriptionId: number) {
    await this.inscriptionParent(utilisateurId, inscriptionId);
    const rows = await this.prisma.bulletin.findMany({
      where: { inscriptionId, publie: true }, orderBy: { periode: 'asc' }, select: { periode: true, datePublication: true },
    });
    return rows.map((r) => ({ semestre: Number(r.periode.replace('Semestre ', '')), datePublication: r.datePublication?.toISOString() ?? null }));
  }

  async voirParent(utilisateurId: number, inscriptionId: number, numero: number) {
    if (numero !== 1 && numero !== 2) throw new BadRequestException('Semestre invalide.');
    const insc = await this.inscriptionParent(utilisateurId, inscriptionId);
    const b = await this.construire(insc, numero);
    if (!b.publie) throw new NotFoundException("Ce bulletin n'est pas disponible.");
    return b;
  }

  // Progression : ce qui a été VU en classe, en lecture seule. Aucune évaluation de l'élève n'est montrée ici :
  // ses niveaux (A, EA, AR, NA) n'apparaissent qu'au bulletin publié.
  async progressionParent(utilisateurId: number, inscriptionId: number, numero: number) {
    if (numero !== 1 && numero !== 2) throw new BadRequestException('Semestre invalide.');
    const insc = await this.inscriptionParent(utilisateurId, inscriptionId); // 404 si ce n'est pas son enfant
    const semestre = await this.verifierSemestre(insc.niveauId, numero);
    const type = insc.niveau.classe.cycle === 'prescolaire' ? 'domaines' : 'lecons';
    const ceintures: CeintureP[] = [];
    let fait = 0, total = 0;

    if (type === 'domaines') {
      const rows = await this.prisma.ceinture.findMany({
        where: { semestreId: semestre.id }, orderBy: { ordre: 'asc' },
        select: {
          nom: true,
          domaines: {
            orderBy: { id: 'asc' },
            select: {
              id: true, nom: true,
              competences: { where: { sousDomaineId: null }, orderBy: { id: 'asc' }, select: { libelle: true } },
              sousDomaines: { orderBy: { id: 'asc' }, select: { nom: true, competences: { orderBy: { id: 'asc' }, select: { libelle: true } } } },
            },
          },
        },
      });
      const domaineIds = rows.flatMap((c) => c.domaines.map((d) => d.id));
      const suivis = domaineIds.length
        ? await this.prisma.progressionDomaine.findMany({ where: { salleId: insc.salleId, domaineId: { in: domaineIds } }, select: { domaineId: true, statut: true } })
        : [];
      const statut = new Map(suivis.map((s) => [s.domaineId, s.statut]));
      for (const c of rows) {
        ceintures.push({
          nom: c.nom,
          groupes: c.domaines.map((d) => {
            const s = (statut.get(d.id) as 'en_cours' | 'termine' | undefined) ?? 'aucun';
            total++; if (s === 'termine') fait++;
            const sections: SectionP[] = [];
            if (d.competences.length) sections.push({ titre: null, items: d.competences.map((x) => ({ libelle: x.libelle, vu: null })) });
            for (const sd of d.sousDomaines) sections.push({ titre: sd.nom, items: sd.competences.map((x) => ({ libelle: x.libelle, vu: null })) });
            return { titre: d.nom, statut: s, sections };
          }),
        });
      }
    } else {
      const rows = await this.prisma.ceinture.findMany({ where: { semestreId: semestre.id }, orderBy: { ordre: 'asc' }, select: { id: true, nom: true } });
      const lecons = await this.prisma.lecon.findMany({
        where: { ceintureId: { in: rows.map((r) => r.id) }, niveauId: insc.niveauId },
        orderBy: [{ matiereId: 'asc' }, { rubriqueId: 'asc' }, { ordre: 'asc' }, { id: 'asc' }],
        select: { id: true, titre: true, ceintureId: true, matiere: { select: { nom: true } }, rubrique: { select: { nom: true } } },
      });
      const vues = lecons.length
        ? await this.prisma.progressionLecon.findMany({ where: { salleId: insc.salleId, leconId: { in: lecons.map((l) => l.id) } }, select: { leconId: true } })
        : [];
      const vuesSet = new Set(vues.map((v) => v.leconId));
      for (const c of rows) {
        const groupes: GroupeP[] = [];
        for (const l of lecons.filter((x) => x.ceintureId === c.id)) {
          let g = groupes.find((x) => x.titre === l.matiere.nom);
          if (!g) { g = { titre: l.matiere.nom, statut: null, sections: [] }; groupes.push(g); }
          const titre = l.rubrique?.nom ?? null;
          let s = g.sections.find((x) => x.titre === titre);
          if (!s) { s = { titre, items: [] }; g.sections.push(s); }
          const vu = vuesSet.has(l.id);
          total++; if (vu) fait++;
          s.items.push({ libelle: l.titre, vu });
        }
        ceintures.push({ nom: c.nom, groupes });
      }
    }

    return {
      inscriptionId: insc.id,
      eleve: { nom: insc.eleve.nom, prenom: insc.eleve.prenom },
      salle: insc.salle.nom, niveau: insc.niveau.nom, annee: insc.anneeScolaire.libelle, semestre: numero,
      type, ceintures, resume: { fait, total },
    };
  }

  // ------------------------------------------
  async annees() {
    const courante = await this.anneeCourante();
    const rows = await this.prisma.anneeScolaire.findMany({ orderBy: { dateDebut: 'desc' }, select: { id: true, libelle: true } });
    return rows.map((a) => ({ id: a.id, libelle: a.libelle, courante: a.id === courante.id }));
  }

  private async messagesParents(inscriptionIds: number[], numero: number) {
    if (inscriptionIds.length === 0) return [];
    const rows = await this.prisma.inscription.findMany({
      where: { id: { in: inscriptionIds } },
      select: {
        eleve: { select: { prenom: true, parents: { select: { parent: { select: { utilisateur: { select: { id: true, actif: true } } } } } } } },
      },
    });
    const data: { utilisateurId: number; message: string }[] = [];
    for (const r of rows) {
      const vus = new Set<number>();
      for (const p of r.eleve.parents) {
        const u = p.parent.utilisateur;
        if (u?.actif && !vus.has(u.id)) {
          vus.add(u.id);
          data.push({ utilisateurId: u.id, message: `Le bulletin du semestre ${numero} de ${r.eleve.prenom} est disponible.` });
        }
      }
    }
    return data;
  }

  async historiqueParent(utilisateurId: number, inscriptionId: number) {
    const insc = await this.inscriptionParent(utilisateurId, inscriptionId); // contrôle d'appartenance
    const rows = await this.prisma.inscription.findMany({
      where: { eleveId: insc.eleveId, statut: 'validee', bulletins: { some: { publie: true } } },
      orderBy: { anneeScolaire: { dateDebut: 'desc' } },
      select: {
        id: true, niveau: { select: { nom: true } }, anneeScolaire: { select: { libelle: true } },
        bulletins: { where: { publie: true }, orderBy: { periode: 'asc' }, select: { periode: true, datePublication: true } },
      },
    });
    return {
      eleve: `${insc.eleve.prenom} ${insc.eleve.nom}`,
      inscriptions: rows.map((r) => ({
        inscriptionId: r.id, annee: r.anneeScolaire.libelle, niveau: r.niveau.nom,
        semestres: r.bulletins.map((x) => ({ semestre: Number(x.periode.replace('Semestre ', '')), datePublication: x.datePublication?.toISOString() ?? null })),
      })),
    };
  }
}
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NiveauCompetence, Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppreciationDto, PublicationClasseDto, PublicationDto } from './dto/bulletins.dto';
import { EvaluationsService } from './evaluations.service';
import type { Acteur } from './evaluations.service';
import { NOM_NIVEAU_EXAMEN, moyennePonderee } from './examens.service';


const periode = (n: number) => `Semestre ${n}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const aujourdhui = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); // UTC+3

const INSC_SELECT = {
  id: true, salleId: true, niveauId: true, anneeScolaireId: true, statut: true, eleveId: true,
  eleve: { select: { nom: true, prenom: true, matricule: true, dateNaissance: true } },
  salle: { select: { nom: true } },
  niveau: { select: { nom: true, classe: { select: { cycle: true } } } },
  anneeScolaire: { select: { libelle: true } },
} satisfies Prisma.InscriptionSelect;;

type InscCtx = Prisma.InscriptionGetPayload<{ select: typeof INSC_SELECT }>;

interface Item { libelle: string; niveau: NiveauCompetence | null }
interface SectionB { titre: string | null; items: Item[] }
interface GroupeB { titre: string; sections: SectionB[] }
interface CeintureB { nom: string; groupes: GroupeB[] }

@Injectable()
export class BulletinsService {
  constructor(private readonly prisma: PrismaService, private readonly evaluations: EvaluationsService) {}

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

  private async salleAffectee(utilisateurId: number) {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId }, select: { personnel: { select: { salleAffecteeId: true } } },
    });
    return u?.personnel?.salleAffecteeId ?? null;
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

  // ---------- Construction du bulletin (calculé, jamais recopié) ----------

  private async construire(insc: InscCtx, numero: number) {
    const semestre = await this.verifierSemestre(insc.niveauId, numero);
    const type = insc.niveau.classe.cycle === 'prescolaire' ? 'domaines' : 'lecons';
    const resume = { A: 0, EA: 0, AR: 0, nonEvalue: 0 };
    const compter = (n: NiveauCompetence | null) => { if (n) resume[n]++; else resume.nonEvalue++; };
    const ceintures: CeintureB[] = [];

    if (type === 'domaines') {
      const rows = await this.prisma.ceinture.findMany({
        where: { semestreId: semestre.id }, orderBy: { ordre: 'asc' },
        select: {
          nom: true,
          domaines: {
            orderBy: { id: 'asc' },
            select: {
              nom: true,
              competences: { where: { sousDomaineId: null }, orderBy: { id: 'asc' }, select: { id: true, libelle: true } },
              sousDomaines: { orderBy: { id: 'asc' }, select: { nom: true, competences: { orderBy: { id: 'asc' }, select: { id: true, libelle: true } } } },
            },
          },
        },
      });
      const ids = rows.flatMap((c) => c.domaines.flatMap((d) => [...d.competences, ...d.sousDomaines.flatMap((s) => s.competences)])).map((x) => x.id);
      const notes = ids.length
        ? await this.prisma.noteCompetence.findMany({ where: { inscriptionId: insc.id, competenceId: { in: ids } }, select: { competenceId: true, niveau: true } })
        : [];
      const parId = new Map(notes.map((n) => [n.competenceId, n.niveau]));
      const item = (x: { id: number; libelle: string }): Item => { const n = parId.get(x.id) ?? null; compter(n); return { libelle: x.libelle, niveau: n }; };

      for (const c of rows) {
        ceintures.push({
          nom: c.nom,
          groupes: c.domaines.map((d) => {
            const sections: SectionB[] = [];
            if (d.competences.length) sections.push({ titre: null, items: d.competences.map(item) });
            for (const s of d.sousDomaines) sections.push({ titre: s.nom, items: s.competences.map(item) });
            return { titre: d.nom, sections };
          }),
        });
      }
    } else {
      const rows = await this.prisma.ceinture.findMany({ where: { semestreId: semestre.id }, orderBy: { ordre: 'asc' }, select: { id: true, nom: true } });
      const lecons = await this.prisma.lecon.findMany({
        where: { ceintureId: { in: rows.map((r) => r.id) }, niveauId: insc.niveauId },
        orderBy: [{ matiereId: 'asc' }, { rubriqueId: 'asc' }, { ordre: 'asc' }, { id: 'asc' }],
        select: { id: true, titre: true, ceintureId: true, matiere: { select: { id: true, nom: true } }, rubrique: { select: { nom: true } } },
      });
      const notes = lecons.length
        ? await this.prisma.noteLecon.findMany({ where: { inscriptionId: insc.id, leconId: { in: lecons.map((l) => l.id) } }, select: { leconId: true, niveau: true } })
        : [];
      const parId = new Map(notes.map((n) => [n.leconId, n.niveau]));

      for (const c of rows) {
        const groupes: GroupeB[] = [];
        for (const l of lecons.filter((x) => x.ceintureId === c.id)) {
          let g = groupes.find((x) => x.titre === l.matiere.nom);
          if (!g) { g = { titre: l.matiere.nom, sections: [] }; groupes.push(g); }
          const titre = l.rubrique?.nom ?? null;
          let s = g.sections.find((x) => x.titre === titre);
          if (!s) { s = { titre, items: [] }; g.sections.push(s); }
          const n = parId.get(l.id) ?? null;
          compter(n);
          s.items.push({ libelle: l.titre, niveau: n });
        }
        ceintures.push({ nom: c.nom, groupes });
      }
    }

    // 7e : examens blancs déjà passés, notes /20 et moyenne pondérée, sans rang
    let examens: { numero: number; date: string; moyenne: number | null; notes: { discipline: string; coefficient: number; note: number | null }[] }[] | null = null;
    if (insc.niveau.nom.toLowerCase() === NOM_NIVEAU_EXAMEN.toLowerCase()) {
      const exs = await this.prisma.examenBlanc.findMany({
        where: { niveauId: insc.niveauId, anneeScolaireId: insc.anneeScolaireId, date: { lte: new Date(`${aujourdhui()}T00:00:00.000Z`) } },
        orderBy: { numero: 'asc' },
        select: { numero: true, date: true, disciplines: { orderBy: { id: 'asc' }, select: { id: true, coefficient: true, matiere: { select: { nom: true } } } } },
      });
      const ids = exs.flatMap((e) => e.disciplines.map((d) => d.id));
      const notes = ids.length
        ? await this.prisma.noteExamen.findMany({ where: { inscriptionId: insc.id, disciplineId: { in: ids } }, select: { disciplineId: true, note: true } })
        : [];
      const m = new Map(notes.map((n) => [n.disciplineId, Number(n.note)]));
      examens = exs.map((e) => ({
        numero: e.numero, date: iso(e.date),
        moyenne: moyennePonderee(e.disciplines.map((d) => ({ id: d.id, coefficient: d.coefficient })), m),
        notes: e.disciplines.map((d) => ({ discipline: d.matiere.nom, coefficient: d.coefficient, note: m.get(d.id) ?? null })),
      }));
    }

    const b = await this.prisma.bulletin.findUnique({
      where: { inscriptionId_periode: { inscriptionId: insc.id, periode: periode(numero) } },
      select: { appreciationGenerale: true, publie: true, datePublication: true },
    });

    return {
      inscriptionId: insc.id,
      eleve: { nom: insc.eleve.nom, prenom: insc.eleve.prenom, matricule: insc.eleve.matricule, dateNaissance: iso(insc.eleve.dateNaissance) },
      salle: insc.salle.nom, niveau: insc.niveau.nom, annee: insc.anneeScolaire.libelle, semestre: numero,
      type, ceintures, resume, examens,
      appreciation: b?.appreciationGenerale ?? null,
      publie: b?.publie ?? false,
      datePublication: b?.datePublication ? b.datePublication.toISOString() : null,
    };
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
    await this.verifierSemestre(niveauId, numero);

    let annee: { id: number };
    if (anneeId !== undefined) {
      if (!Number.isInteger(anneeId)) throw new BadRequestException('Année invalide.');
      if (acteur.role === RoleUtilisateur.ENSEIGNANT) throw new ForbiddenException('Seule la Direction consulte les années précédentes.');
      const a = await this.prisma.anneeScolaire.findUnique({ where: { id: anneeId }, select: { id: true } });
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
    return {
      salle,
      eleves: inscriptions.map((i) => ({
        inscriptionId: i.id, nom: i.eleve.nom, prenom: i.eleve.prenom, matricule: i.eleve.matricule,
        aAppreciation: !!parId.get(i.id)?.appreciationGenerale, publie: parId.get(i.id)?.publie ?? false,
      })),
    };
  }

  async voir(acteur: Acteur, inscriptionId: number, numero: number) {
    if (numero !== 1 && numero !== 2) throw new BadRequestException('Semestre invalide.');
    return this.construire(await this.inscriptionStaff(acteur, inscriptionId), numero);
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
        data: { utilisateurId: acteur.id, action: 'APPRECIATION_BULLETIN', entite: 'Bulletin', entiteId: inscriptionId, details: { semestre: dto.semestre, longueur: texte?.length ?? 0, apresPublication: existant?.publie ?? false }, },
      }),
    ]);
    return { enregistre: true };
  }

  async publier(acteur: Acteur, inscriptionId: number, dto: PublicationDto) {
    const insc = await this.inscriptionStaff(acteur, inscriptionId);
    await this.verifierSemestre(insc.niveauId, dto.semestre);
    const b = await this.prisma.bulletin.findUnique({
      where: { inscriptionId_periode: { inscriptionId, periode: periode(dto.semestre) } },
      select: { id: true, appreciationGenerale: true, publie: true },
    });

    if (dto.publie) {
      if (!b?.appreciationGenerale) throw new BadRequestException("Rédigez l'appréciation générale avant de publier.");
      if (b.publie) return { publie: true, parentsPrevenus: 0 };
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
    const aPublier = await this.prisma.bulletin.findMany({
      where: { inscriptionId: { in: ids }, periode: periode(dto.semestre), publie: false, appreciationGenerale: { not: null } },
      select: { id: true, inscriptionId: true },
    });
    const dejaPublies = c.eleves.filter((e) => e.publie).length;
    let prevenus = 0;
    if (aPublier.length > 0) {
      const notifications = await this.messagesParents(aPublier.map((x) => x.inscriptionId), dto.semestre);
      const ops: Prisma.PrismaPromise<unknown>[] = [
        this.prisma.bulletin.updateMany({ where: { id: { in: aPublier.map((x) => x.id) }, publie: false }, data: { publie: true, datePublication: new Date() } }),
        this.prisma.journalAudit.create({
          data: { utilisateurId: acteur.id, action: 'BULLETINS_PUBLIES_CLASSE', entite: 'Salle', entiteId: dto.salleId, details: { semestre: dto.semestre, publies: aPublier.length, parentsPrevenus: notifications.length } },
        }),
      ];
      if (notifications.length > 0) ops.push(this.prisma.notification.createMany({ data: notifications }));
      await this.prisma.$transaction(ops);
      prevenus = notifications.length;
    }
    return { publies: aPublier.length, sansAppreciation: ids.length - dejaPublies - aPublier.length, parentsPrevenus: prevenus };
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
 
 

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, StatutRendezVous } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOM_NIVEAU_EXAMEN } from '../pedagogie/examens.service';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const jourMada = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); // UTC+3
const enJour = (s: string) => new Date(`${s}T00:00:00.000Z`);

const filtreCompetence = (niveauId: number, numero: number): Prisma.CompetenceWhereInput => ({
  OR: [
    { domaine: { ceinture: { semestre: { niveauId, numero } } } },
    { sousDomaine: { domaine: { ceinture: { semestre: { niveauId, numero } } } } },
  ],
});

@Injectable()
export class EspaceEnseignantService {
  constructor(private readonly prisma: PrismaService) {}

  private async anneeCourante() {
    const maintenant = new Date();
    const annee =
      (await this.prisma.anneeScolaire.findFirst({
        where: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } }, select: { id: true },
      })) ?? (await this.prisma.anneeScolaire.findFirst({ orderBy: { dateDebut: 'desc' }, select: { id: true } }));
    if (!annee) throw new BadRequestException('Aucune année scolaire configurée.');
    return annee;
  }

  private async personnel(utilisateurId: number) {
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { personnel: { select: { id: true, nom: true, prenom: true, salleAffecteeId: true } } },
    });
    if (!u?.personnel) throw new ForbiddenException('Aucune fiche personnel liée à votre compte.');
    return u.personnel;
  }

  // Avancement d'un niveau pour un semestre (compte uniquement, aucune donnée recopiée)
  private async avancementSemestre(salleId: number, niveauId: number, domaines: boolean, numero: number, ids: number[]) {
    const bulletins = ids.length
      ? this.prisma.bulletin.count({ where: { inscriptionId: { in: ids }, periode: `Semestre ${numero}`, appreciationGenerale: { not: null } } })
      : Promise.resolve(0);

    if (domaines) {
      const f = filtreCompetence(niveauId, numero);
      const [elements, saisies, suiviTotal, suivi, rediges] = await Promise.all([
        this.prisma.competence.count({ where: f }),
        ids.length ? this.prisma.noteCompetence.count({ where: { inscriptionId: { in: ids }, competence: f } }) : 0,
        this.prisma.domaine.count({ where: { ceinture: { semestre: { niveauId, numero } } } }),
        this.prisma.progressionDomaine.count({ where: { salleId, statut: 'termine', domaine: { ceinture: { semestre: { niveauId, numero } } } } }),
        bulletins,
      ]);
      return { semestre: numero, effectif: ids.length, elements, attendues: elements * ids.length, saisies, suiviTotal, suivi, bulletinsRediges: rediges };
    }
    const f: Prisma.LeconWhereInput = { niveauId, ceinture: { semestre: { numero } } };
    const [elements, saisies, suivi, rediges] = await Promise.all([
      this.prisma.lecon.count({ where: f }),
      ids.length ? this.prisma.noteLecon.count({ where: { inscriptionId: { in: ids }, lecon: f } }) : 0,
      this.prisma.progressionLecon.count({ where: { salleId, lecon: f } }),
      bulletins,
    ]);
    return { semestre: numero, effectif: ids.length, elements, attendues: elements * ids.length, saisies, suiviTotal: elements, suivi, bulletinsRediges: rediges };
  }

  async accueil(utilisateurId: number) {
    const p = await this.personnel(utilisateurId);
    const enseignant = { prenom: p.prenom, nom: p.nom };
    const jour = jourMada();
    const jourSemaine = ((enJour(jour).getUTCDay() + 6) % 7) + 1; // 1 = lundi ... 7 = dimanche
    const jourOuvre = jourSemaine <= 5;
    if (!p.salleAffecteeId) return { enseignant, salle: null, aujourdhui: jour, jourOuvre };

    const salle = await this.prisma.salle.findUnique({
      where: { id: p.salleAffecteeId },
      select: { id: true, nom: true, niveaux: { orderBy: { ordre: 'asc' }, select: { id: true, nom: true, classe: { select: { cycle: true } } } } },
    });
    if (!salle) return { enseignant, salle: null, aujourdhui: jour, jourOuvre };

    const annee = await this.anneeCourante();
    const inscriptions = await this.prisma.inscription.findMany({
      where: { salleId: salle.id, anneeScolaireId: annee.id, statut: 'validee' }, select: { id: true, niveauId: true },
    });
    const idsParNiveau = new Map<number, number[]>();
    for (const i of inscriptions) idsParNiveau.set(i.niveauId, [...(idsParNiveau.get(i.niveauId) ?? []), i.id]);

    const debut = new Date(`${jour}T00:00:00+03:00`);
    const fin = new Date(debut.getTime() + 8 * 24 * 3600 * 1000);

    const [absents, cours, rdv, niveaux] = await Promise.all([
      jourOuvre
        ? this.prisma.absence.findMany({
            where: { date: enJour(jour), inscription: { salleId: salle.id, anneeScolaireId: annee.id } },
            select: { justifiee: true, inscription: { select: { eleve: { select: { nom: true, prenom: true } } } } },
          })
        : Promise.resolve([]),
      jourOuvre
        ? this.prisma.emploiDuTemps.findMany({
            where: { salleId: salle.id, anneeScolaireId: annee.id, jourSemaine },
            orderBy: [{ heureDebut: 'asc' }],
            select: { heureDebut: true, heureFin: true, titre: true, matiere: { select: { nom: true } }, niveau: { select: { nom: true } } },
          })
        : Promise.resolve([]),
      this.prisma.rendezVous.findMany({
        where: { utilisateurId, statut: { in: [StatutRendezVous.DEMANDE, StatutRendezVous.CONFIRME] }, dateHeure: { gte: debut, lt: fin } },
        orderBy: { dateHeure: 'asc' }, take: 15,
        select: { id: true, dateHeure: true, statut: true, motif: true, parent: { select: { prenom: true, nom: true } } },
      }),
      Promise.all(
        salle.niveaux.map(async (n) => {
          const ids = idsParNiveau.get(n.id) ?? [];
          const domaines = n.classe.cycle === 'prescolaire';
          const semestres = await this.prisma.semestre.findMany({ where: { niveauId: n.id }, orderBy: { numero: 'asc' }, select: { numero: true } });
          const avancement = await Promise.all(semestres.map((s) => this.avancementSemestre(salle.id, n.id, domaines, s.numero, ids)));
          return { id: n.id, nom: n.nom, type: domaines ? ('domaines' as const) : ('lecons' as const), effectif: ids.length, avancement };
        }),
      ),
    ]);

    // Examens blancs (niveau concerné uniquement)
    let examens: { id: number; numero: number; date: string; passe: boolean; saisies: number; attendues: number }[] = [];
    const n7 = salle.niveaux.find((n) => n.nom.toLowerCase() === NOM_NIVEAU_EXAMEN.toLowerCase());
    if (n7) {
      const ids7 = idsParNiveau.get(n7.id) ?? [];
      const exs = await this.prisma.examenBlanc.findMany({
        where: { niveauId: n7.id, anneeScolaireId: annee.id }, orderBy: { numero: 'asc' },
        select: { id: true, numero: true, date: true, disciplines: { select: { id: true } } },
      });
      const discIds = exs.flatMap((e) => e.disciplines.map((d) => d.id));
      const g = discIds.length && ids7.length
        ? await this.prisma.noteExamen.groupBy({ by: ['disciplineId'], where: { disciplineId: { in: discIds }, inscriptionId: { in: ids7 } }, _count: { _all: true } })
        : [];
      const nb = new Map(g.map((x) => [x.disciplineId, x._count._all]));
      examens = exs.map((e) => ({
        id: e.id, numero: e.numero, date: iso(e.date), passe: iso(e.date) <= jour,
        saisies: e.disciplines.reduce((s, d) => s + (nb.get(d.id) ?? 0), 0),
        attendues: e.disciplines.length * ids7.length,
      }));
    }

    return {
      enseignant,
      salle: { id: salle.id, nom: salle.nom, effectif: inscriptions.length, niveaux },
      aujourdhui: jour, jourOuvre,
      absentsAujourdhui: absents.map((a) => ({ prenom: a.inscription.eleve.prenom, nom: a.inscription.eleve.nom, justifiee: a.justifiee })),
      cours: cours.map((c) => ({ debut: c.heureDebut, fin: c.heureFin, niveau: c.niveau.nom, libelle: c.matiere?.nom ?? c.titre ?? 'Activité' })),
      rendezVous: rdv.map((r) => ({
        id: r.id, dateHeure: r.dateHeure.toISOString(), statut: r.statut, motif: r.motif ?? null, parent: `${r.parent.prenom} ${r.parent.nom}`,
      })),
      examens,
    };
  }
  // Indique si la salle de l'enseignant accueille le niveau des examens blancs (Classe 3)
  async profil(utilisateurId: number) {
    const p = await this.personnel(utilisateurId);
    if (!p.salleAffecteeId) return { avecExamens: false, avecAbsences: false };
    const niveaux = await this.prisma.niveau.findMany({
      where: { salles: { some: { id: p.salleAffecteeId } } },
      select: { nom: true, classe: { select: { cycle: true } } },
    });
    return {
      avecExamens: niveaux.some((n) => n.nom.toLowerCase() === NOM_NIVEAU_EXAMEN.toLowerCase()),
      avecAbsences: niveaux.some((n) => n.classe.cycle === 'college'),
    };
  }
  async eleves(utilisateurId: number) {
    const p = await this.personnel(utilisateurId);
    if (!p.salleAffecteeId) return { salle: null, eleves: [] };
    const annee = await this.anneeCourante();
    const salle = await this.prisma.salle.findUnique({ where: { id: p.salleAffecteeId }, select: { id: true, nom: true } });
    const rows = await this.prisma.inscription.findMany({
      where: { salleId: p.salleAffecteeId, anneeScolaireId: annee.id, statut: 'validee' },
      orderBy: [{ niveau: { ordre: 'asc' } }, { eleve: { nom: 'asc' } }, { eleve: { prenom: 'asc' } }],
      select: {
        id: true, niveau: { select: { nom: true } },
        eleve: { select: { nom: true, prenom: true, matricule: true, sexe: true, dateNaissance: true } },
        absences: { select: { justifiee: true } },
      },
    });
    return {
      salle,
      eleves: rows.map((r) => ({
        inscriptionId: r.id, nom: r.eleve.nom, prenom: r.eleve.prenom, matricule: r.eleve.matricule, sexe: r.eleve.sexe,
        dateNaissance: iso(r.eleve.dateNaissance), niveau: r.niveau.nom,
        absences: r.absences.length, nonJustifiees: r.absences.filter((a) => !a.justifiee).length,
      })),
    };
  }
}
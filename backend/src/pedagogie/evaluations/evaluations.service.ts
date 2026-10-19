import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NoteCompetenceDto } from './dto/note-competence.dto';
import { NoteLeconDto } from './dto/note-lecon.dto';
import { CreateExamenDto } from './dto/create-examen.dto';
import { NoteExamenDto } from './dto/note-examen.dto';

@Injectable()
export class EvaluationsService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------
  // Classe 1 : notes de competence (A / EA / AR) -- Domaine/SousDomaine/Competence
  // ---------------------------------------------------------------
  async saisirNoteCompetence(dto: NoteCompetenceDto, enseignantId: number) {
    return this.prisma.noteCompetence.upsert({
      where: {
        inscriptionId_competenceId: {
          inscriptionId: dto.inscriptionId,
          competenceId: dto.competenceId,
        },
      },
      update: { niveau: dto.niveau as any, enseignantId, dateSaisie: new Date() },
      create: {
        inscriptionId: dto.inscriptionId,
        competenceId: dto.competenceId,
        niveau: dto.niveau as any,
        enseignantId,
      },
    });
  }

  // ---------------------------------------------------------------
  // Classe 2/3/college : notes de lecon (A / EA / AR) -- Matiere/Rubrique/Lecon
  // Meme principe que NoteCompetence : tous les niveaux sont notes en A/EA/AR
  // pour leurs bulletins S1/S2, seul le referentiel change selon le cycle.
  // ---------------------------------------------------------------
  async saisirNoteLecon(dto: NoteLeconDto, enseignantId: number) {
    return this.prisma.noteLecon.upsert({
      where: {
        inscriptionId_leconId: {
          inscriptionId: dto.inscriptionId,
          leconId: dto.leconId,
        },
      },
      update: { niveau: dto.niveau as any, enseignantId, dateSaisie: new Date() },
      create: {
        inscriptionId: dto.inscriptionId,
        leconId: dto.leconId,
        niveau: dto.niveau as any,
        enseignantId,
      },
    });
  }

  // ---------------------------------------------------------------
  // Examens blancs : dispositif /20 a part, scope a un Niveau precis
  // (aujourd'hui Classe 3 - 3e annee, mais pas code en dur), en plus
  // des bulletins A/EA/AR habituels de ce niveau.
  // ---------------------------------------------------------------
  async creerExamen(dto: CreateExamenDto) {
    return this.prisma.examenBlanc.create({
      data: {
        niveauId: dto.niveauId,
        anneeScolaireId: dto.anneeScolaireId,
        numero: dto.numero,
        date: new Date(dto.date),
        disciplines: {
          create: dto.disciplines.map((d) => ({
            matiereId: d.matiereId,
            coefficient: d.coefficient,
          })),
        },
      },
      include: { disciplines: { include: { matiere: true } } },
    });
  }

  async saisirNoteExamen(examenId: number, dto: NoteExamenDto, enseignantId: number) {
    const discipline = await this.prisma.examenBlancDiscipline.findUnique({
      where: { examenBlancId_matiereId: { examenBlancId: examenId, matiereId: dto.matiereId } },
    });
    if (!discipline) {
      throw new NotFoundException(
        `Cette matiere ne fait pas partie de l'examen blanc #${examenId}`,
      );
    }

    return this.prisma.noteExamen.upsert({
      where: {
        disciplineId_inscriptionId: {
          disciplineId: discipline.id,
          inscriptionId: dto.inscriptionId,
        },
      },
      update: { note: dto.note, enseignantId, dateSaisie: new Date() },
      create: {
        disciplineId: discipline.id,
        inscriptionId: dto.inscriptionId,
        note: dto.note,
        enseignantId,
      },
    });
  }

  /**
   * Resultat d'un eleve a UNE session d'examen blanc : note et note ponderee
   * par discipline, total des coefficients, moyenne simple et moyenne ponderee
   * -- correspond exactement au tableau "EXAMEN BLANC" du bulletin papier.
   */
  async calculerMoyenneExamen(examenBlancId: number, inscriptionId: number) {
    const examen = await this.prisma.examenBlanc.findUnique({
      where: { id: examenBlancId },
      include: { disciplines: { include: { matiere: true, notes: { where: { inscriptionId } } } } },
    });
    if (!examen) throw new NotFoundException('Examen blanc introuvable');

    let sommeNotes = 0;
    let sommePonderee = 0;
    let sommeCoefficients = 0;
    let nbNotees = 0;
    const detail = examen.disciplines.map((d) => {
      const note = d.notes[0] ? Number(d.notes[0].note) : null;
      sommeCoefficients += d.coefficient;
      if (note !== null) {
        sommeNotes += note;
        sommePonderee += note * d.coefficient;
        nbNotees += 1;
      }
      return { matiere: d.matiere.nom, coefficient: d.coefficient, note };
    });

    return {
      examenBlancId,
      numero: examen.numero,
      detail,
      totalCoefficients: sommeCoefficients,
      moyenneSimple: nbNotees > 0 ? sommeNotes / nbNotees : null,
      moyennePonderee: sommeCoefficients > 0 ? sommePonderee / sommeCoefficients : null,
    };
  }

  // ---------------------------------------------------------------
  // Vue unifiee d'une inscription : bulletin A/EA/AR (Competence ou Lecon
  // selon le cycle) +, le cas echeant, les examens blancs de son niveau.
  // ---------------------------------------------------------------
  async getNotesInscription(inscriptionId: number) {
    const inscription = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      include: { niveau: { include: { classe: true } } },
    });
    if (!inscription) throw new NotFoundException('Inscription introuvable');

    const estPrescolaire = inscription.niveau.classe.cycle === 'prescolaire';

    const notesCompetence = estPrescolaire
      ? await this.prisma.noteCompetence.findMany({
          where: { inscriptionId },
          include: { competence: { include: { domaine: true, sousDomaine: true } } },
        })
      : undefined;

    const notesLecon = !estPrescolaire
      ? await this.prisma.noteLecon.findMany({
          where: { inscriptionId },
          include: { lecon: { include: { matiere: true, rubrique: true } } },
        })
      : undefined;

    const examensDuNiveau = await this.prisma.examenBlanc.findMany({
      where: { niveauId: inscription.niveauId },
      orderBy: { numero: 'asc' },
    });
    const examensBlancs = await Promise.all(
      examensDuNiveau.map((e) => this.calculerMoyenneExamen(e.id, inscriptionId)),
    );

    return {
      referentiel: estPrescolaire ? 'COMPETENCE' : 'LECON',
      notesCompetence,
      notesLecon,
      examensBlancs: examensBlancs.length > 0 ? examensBlancs : undefined,
    };
  }
}
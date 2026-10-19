import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenererBulletinDto } from './dto/generer-bulletin.dto';

@Injectable()
export class BulletinsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Genere (ou regenere) le bulletin d'une inscription pour une periode.
   * genererAppreciationGenerale() est un stub texte aujourd'hui :
   * c'est le point d'entree prevu pour le futur module d'assistance IA
   * (detection precoce / commentaire auto a partir des notes et de la progression).
   */
  async genererBulletin(dto: GenererBulletinDto) {
    const inscription = await this.prisma.inscription.findUnique({
      where: { id: dto.inscriptionId },
      include: { niveau: { include: { classe: true } }, eleve: true },
    });
    if (!inscription) throw new NotFoundException('Inscription introuvable');

    const appreciationGenerale = await this.genererAppreciationGenerale(
      dto.inscriptionId,
      inscription.niveau.classe.cycle,
    );

    return this.prisma.bulletin.create({
      data: {
        inscriptionId: dto.inscriptionId,
        periode: dto.periode,
        appreciationGenerale,
      },
    });
  }

  async getBulletinsInscription(inscriptionId: number) {
    return this.prisma.bulletin.findMany({
      where: { inscriptionId },
      orderBy: { dateGeneration: 'desc' },
    });
  }

  /**
   * Stub simple aujourd'hui (regle basique) : a remplacer par l'appel au
   * module IA en fin de projet. On garde la signature stable pour ne pas
   * avoir a retoucher le controller/l'appel cote frontend plus tard.
   *
   * Tous les cycles sont notes en A/EA/AR pour leur bulletin S1/S2 ; seul le
   * referentiel change (Competence en prescolaire, Lecon ensuite). Les
   * examens blancs (/20) sont un dispositif a part, non pris en compte ici :
   * genererAppreciationGenerale() ne porte que sur le bulletin normal.
   */
  private async genererAppreciationGenerale(
    inscriptionId: number,
    cycle: string,
  ): Promise<string> {
    const notes =
      cycle === 'prescolaire'
        ? await this.prisma.noteCompetence.findMany({ where: { inscriptionId } })
        : await this.prisma.noteLecon.findMany({ where: { inscriptionId } });

    const total = notes.length;
    if (total === 0) return 'Aucune évaluation saisie sur cette période.';
    const acquis = notes.filter((n) => n.niveau === 'A').length;
    const taux = Math.round((acquis / total) * 100);
    return `${acquis}/${total} items acquis (${taux}%).`;
  }
}
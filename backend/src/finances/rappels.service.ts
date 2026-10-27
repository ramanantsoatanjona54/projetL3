import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancesService } from './finances.service';

const DECALAGE_MS = 3 * 60 * 60 * 1000; // Madagascar : UTC+3
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

@Injectable()
export class RappelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finances: FinancesService,
  ) {}

  async rappeler(inscriptionId: number, acteurId: number) {
    // 1. Le retard doit être réel (calculé par le même service que la page Retards)
    const { lignes } = await this.finances.retards();
    const ligne = (lignes as any[]).find((l) => l.inscriptionId === inscriptionId);
    if (!ligne) throw new NotFoundException("Cet élève n'a pas de retard de paiement.");

    // 2. Un seul rappel par jour et par élève (jour de Madagascar)
    const local = new Date(Date.now() + DECALAGE_MS);
    const debutJour = new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - DECALAGE_MS,
    );
    const deja = await this.prisma.journalAudit.findFirst({
      where: {
        action: 'RAPPEL_PAIEMENT_ENVOYE',
        entite: 'Inscription',
        entiteId: inscriptionId,
        date: { gte: debutJour },
      },
      select: { id: true },
    });
    if (deja) throw new ConflictException("Un rappel a déjà été envoyé aujourd'hui pour cet élève.");

    // 3. Comptes parents actifs de l'élève
    const insc = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      select: {
        eleve: {
          select: {
            prenom: true,
            nom: true,
            parents: { select: { parent: { select: { utilisateur: { select: { id: true, actif: true } } } } } },
          },
        },
      },
    });
    if (!insc) throw new NotFoundException('Inscription introuvable.');

    const destinataires = [
      ...new Set(
        insc.eleve.parents
          .map((p) => p.parent.utilisateur)
          .filter((u): u is { id: number; actif: boolean } => !!u && u.actif)
          .map((u) => u.id),
      ),
    ];
    if (destinataires.length === 0) {
      throw new BadRequestException(
        "Aucun parent de cet élève n'a de compte actif : contactez-le par téléphone.",
      );
    }

    // 4. Notification + trace d'audit, dans une seule transaction
    const total = Math.round(Number(ligne.montantDu) + Number(ligne.penalites));
    const mois = (ligne.moisEnRetard as number[]).map((m) => MOIS[m - 1]).join(', ');
    const message =
      `Rappel de paiement : la scolarité de ${insc.eleve.prenom} ${insc.eleve.nom} est en retard ` +
      `(${mois}). Montant à régler : ${total.toLocaleString('fr-FR')} Ar, pénalités comprises. ` +
      `Merci de vous rapprocher du secrétariat.`;

    await this.prisma.$transaction([
      this.prisma.notification.createMany({
        data: destinataires.map((utilisateurId) => ({ utilisateurId, message })),
      }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId,
          action: 'RAPPEL_PAIEMENT_ENVOYE',
          entite: 'Inscription',
          entiteId: inscriptionId,
          details: { destinataires: destinataires.length, moisEnRetard: ligne.moisEnRetard, montant: total },
        },
      }),
    ]);

    return { envoyes: destinataires.length };
  }
}
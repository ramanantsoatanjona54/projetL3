import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { adresseValide, echapperHtml, MailService } from '../mail/mail.service';
import { FinancesService } from './finances.service';

const DECALAGE_MS = 3 * 60 * 60 * 1000; // Madagascar : UTC+3
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const ECOLE = { nom: 'Les Colibris', telephone: '+261 32 99 124 86' };

// Adresse réellement utilisable : valide ET pas un domaine fictif réservé aux tests (.test, .example, .invalid, .localhost)
const utilisable = (a: string | null | undefined): a is string =>
  adresseValide(a) && !/\.(test|example|invalid|localhost)$/i.test(a.trim());

interface Destinataire { utilisateurId: number; prenom: string; email: string | null }

@Injectable()
export class RappelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finances: FinancesService,
    private readonly mail: MailService,
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
      where: { action: 'RAPPEL_PAIEMENT_ENVOYE', entite: 'Inscription', entiteId: inscriptionId, date: { gte: debutJour } },
      select: { id: true },
    });
    if (deja) throw new ConflictException("Un rappel a déjà été envoyé aujourd'hui pour cet élève.");

    // 3. Comptes parents actifs de l'élève, avec l'adresse e-mail de contact (à défaut, celle du compte)
    const insc = await this.prisma.inscription.findUnique({
      where: { id: inscriptionId },
      select: {
        eleve: {
          select: {
            prenom: true,
            nom: true,
            email1: true,
            email2: true,
            parents: {
              select: {
                parent: { select: { prenom: true, email: true, utilisateur: { select: { id: true, actif: true, email: true } } } },
              },
            },
          },
        },
      },
    });
    if (!insc) throw new NotFoundException('Inscription introuvable.');

    const vus = new Set<number>();
    const destinataires: Destinataire[] = [];
    for (const p of insc.eleve.parents) {
      const u = p.parent.utilisateur;
      if (!u || !u.actif || vus.has(u.id)) continue;
      vus.add(u.id);
      // Ordre : e-mail de contact du parent, puis e-mails de contact de la fiche élève, puis e-mail du compte
      const email = [p.parent.email, insc.eleve.email1, insc.eleve.email2, u.email].find(utilisable) ?? null;
      destinataires.push({ utilisateurId: u.id, prenom: p.parent.prenom, email });
    }
    if (destinataires.length === 0) {
      throw new BadRequestException("Aucun parent de cet élève n'a de compte actif : contactez-le par téléphone.");
    }

    // 4. Notification dans le compte + trace d'audit, dans une seule transaction
    const total = Math.round(Number(ligne.montantDu) + Number(ligne.penalites));
    const montant = `${total.toLocaleString('fr-FR')} Ar`;
    const mois = (ligne.moisEnRetard as number[]).map((m) => MOIS[m - 1]).join(', ');
    const enfant = `${insc.eleve.prenom} ${insc.eleve.nom}`;
    const message =
      `Rappel de paiement : la scolarité de ${enfant} est en retard (${mois}). ` +
      `Montant à régler : ${montant}, pénalités comprises. Merci de vous rapprocher du secrétariat.`;

    await this.prisma.$transaction([
      this.prisma.notification.createMany({ data: destinataires.map((d) => ({ utilisateurId: d.utilisateurId, message })) }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId, action: 'RAPPEL_PAIEMENT_ENVOYE', entite: 'Inscription', entiteId: inscriptionId,
          details: { destinataires: destinataires.length, moisEnRetard: ligne.moisEnRetard, montant: total },
        },
      }),
    ]);

    // 5. E-mails, après validation de la transaction : un échec d'envoi n'annule jamais la notification
    const emails = { envoyes: 0, echecs: 0, sansAdresse: 0, configure: this.mail.configure };
    if (emails.configure) {
      const adressesFaites = new Set<string>();
      for (const d of destinataires) {
        if (!d.email) { emails.sansAdresse++; continue; }
        const cle = d.email.toLowerCase();
        if (adressesFaites.has(cle)) continue; // deux parents, même adresse : un seul e-mail
        adressesFaites.add(cle);
        const sujet = `Rappel de paiement – ${ECOLE.nom}`;
        const texte =
          `Bonjour ${d.prenom},\n\nLa scolarité de ${enfant} est en retard de paiement (${mois}).\n` +
          `Montant à régler : ${montant}, pénalités comprises.\n\n` +
          `Si vous avez déjà réglé, merci d'ignorer ce message. Sinon, rapprochez-vous du secrétariat (${ECOLE.telephone}).\n\n` +
          `Cordialement,\n${ECOLE.nom}`;
        const html =
          `<p>Bonjour ${echapperHtml(d.prenom)},</p>` +
          `<p>La scolarité de <strong>${echapperHtml(enfant)}</strong> est en retard de paiement (${echapperHtml(mois)}).<br>` +
          `Montant à régler : <strong>${echapperHtml(montant)}</strong>, pénalités comprises.</p>` +
          `<p>Si vous avez déjà réglé, merci d'ignorer ce message. Sinon, rapprochez-vous du secrétariat (${echapperHtml(ECOLE.telephone)}).</p>` +
          `<p>Cordialement,<br>${echapperHtml(ECOLE.nom)}</p>`;
        const r = await this.mail.envoyer(d.email, sujet, texte, html);
        if (r === 'envoye') emails.envoyes++; else emails.echecs++;
      }
    }
    await this.prisma.journalAudit.create({
      data: {
        utilisateurId: acteurId, action: 'RAPPEL_PAIEMENT_EMAIL', entite: 'Inscription', entiteId: inscriptionId,
        details: { configure: emails.configure, envoyes: emails.envoyes, echecs: emails.echecs, sansAdresse: emails.sansAdresse },
      },
    });

    return { envoyes: destinataires.length, emails };
  }
}
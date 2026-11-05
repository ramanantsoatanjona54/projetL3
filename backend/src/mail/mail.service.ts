import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type ResultatEnvoi = 'envoye' | 'echec' | 'non_configure';

const ADRESSE_VALIDE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export const adresseValide = (a: string | null | undefined): a is string => !!a && a.length <= 254 && ADRESSE_VALIDE.test(a);

export const echapperHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Envoi d'e-mails via le SMTP de Gmail (mot de passe d'application). Les identifiants ne viennent que du fichier .env.
// Sans configuration, l'application fonctionne normalement : seul l'e-mail est ignoré.
@Injectable()
export class MailService {
  private readonly journal = new Logger(MailService.name);
  private transport: Transporter | null = null;

  get configure(): boolean {
    return !!process.env.MAIL_UTILISATEUR && !!process.env.MAIL_MOT_DE_PASSE;
  }

  private obtenirTransport(): Transporter {
    if (!this.transport) {
      const port = Number(process.env.MAIL_PORT ?? 465);
      this.transport = createTransport({
        host: process.env.MAIL_HOTE ?? 'smtp.gmail.com',
        port,
        secure: port === 465,
        auth: {
          user: process.env.MAIL_UTILISATEUR as string,
          pass: (process.env.MAIL_MOT_DE_PASSE as string).replace(/\s+/g, ''), // Google l'affiche par groupes de 4
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    }
    return this.transport;
  }

  // Ne journalise jamais l'adresse ni le contenu du message
  async envoyer(destinataire: string, sujet: string, texte: string, html: string): Promise<ResultatEnvoi> {
    if (!this.configure) return 'non_configure';
    if (!adresseValide(destinataire)) return 'echec';
    try {
      const nom = (process.env.MAIL_EXPEDITEUR_NOM ?? 'Les Colibris').replace(/["<>\r\n]/g, '');
      await this.obtenirTransport().sendMail({
        from: `"${nom}" <${process.env.MAIL_UTILISATEUR}>`,
        to: destinataire,
        subject: sujet,
        text: texte,
        html,
      });
      return 'envoye';
    } catch (e) {
      this.journal.warn(`Échec d'envoi d'e-mail : ${e instanceof Error ? e.message.slice(0, 160) : 'erreur inconnue'}`);
      return 'echec';
    }
  }
}
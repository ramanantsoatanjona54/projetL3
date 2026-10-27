import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleUtilisateur, StatutRendezVous } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DemanderRendezVousDto, RaisonDto } from './dto/relation-parents.dto';
import { parentIdDe } from './parent-courant';

// ---- Règles métier (à ajuster ici) ----
const DELAI_MIN_H = 2;   // délai minimum avant le rendez-vous
const HORIZON_J = 60;    // on ne réserve pas plus loin
const ZONE = 'Indian/Antananarivo'; // UTC+3
const CRENEAUX: string[] = [];
for (let h = 8; h <= 16; h++) for (const m of ['00', '30']) CRENEAUX.push(`${String(h).padStart(2, '0')}:${m}`); // 08:00 à 16:30

const ACTIFS = [StatutRendezVous.DEMANDE, StatutRendezVous.CONFIRME];
const enJour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const quand = (d: Date) =>
  d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: ZONE });
const voitTout = (r: RoleUtilisateur) => r === RoleUtilisateur.ADMIN || r === RoleUtilisateur.DIRECTRICE;
const nomAffiche = (u: { role: RoleUtilisateur; personnel: { nom: string; prenom: string } | null }) =>
  u.personnel ? `${u.personnel.prenom} ${u.personnel.nom}` : u.role === 'DIRECTRICE' ? 'Direction' : u.role === 'SECRETARIAT' ? 'Secrétariat' : 'École';

export interface Acteur { id: number; role: RoleUtilisateur }
export interface FiltresRdv { statut?: string; page?: string; taille?: string }

interface RdvCharge {
  id: number; statut: StatutRendezVous; utilisateurId: number; dateHeure: Date;
  parent: { utilisateur: { id: number; actif: boolean } | null };
}

@Injectable()
export class RendezVousService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= CÔTÉ PARENT =================

  async options(userId: number) {
    const parentId = await parentIdDe(this.prisma, userId);
    return {
      interlocuteurs: await this.interlocuteurs(parentId),
      creneaux: CRENEAUX, delaiMinHeures: DELAI_MIN_H, horizonJours: HORIZON_J,
    };
  }

  // Direction, secrétariat et enseignant(e) de la salle d'un de ses enfants (année en cours)
  private async interlocuteurs(parentId: number) {
    const maintenant = new Date();
    const inscriptions = await this.prisma.inscription.findMany({
      where: {
        statut: 'validee',
        anneeScolaire: { dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } },
        eleve: { parents: { some: { parentId } } },
      },
      select: { salleId: true },
    });
    const salleIds = [...new Set(inscriptions.map((i) => i.salleId).filter((s): s is number => s !== null))];

    const comptes = await this.prisma.utilisateur.findMany({
      where: {
        actif: true,
        OR: [
          { role: { in: [RoleUtilisateur.DIRECTRICE, RoleUtilisateur.SECRETARIAT] } },
          { role: RoleUtilisateur.ENSEIGNANT, personnel: { salleAffecteeId: { in: salleIds }, dateDepart: null } },
        ],
      },
      orderBy: { id: 'asc' },
      select: { id: true, role: true, personnel: { select: { nom: true, prenom: true, salleAffectee: { select: { nom: true } } } } },
    });

    // Un compte « de fonction » (sans fiche personnel) n'apparaît qu'une fois par rôle : pas de doublon
    const dejaVu = new Set<string>();
    const liste: { utilisateurId: number; nom: string; fonction: string }[] = [];
    for (const c of comptes) {
      if (!c.personnel) {
        if (dejaVu.has(c.role)) continue;
        dejaVu.add(c.role);
      }
      const fonction =
        c.role === 'ENSEIGNANT'
          ? `Enseignant(e)${c.personnel?.salleAffectee ? ` · salle ${c.personnel.salleAffectee.nom}` : ''}`
          : c.role === 'DIRECTRICE' ? 'Direction' : 'Secrétariat';
      liste.push({ utilisateurId: c.id, nom: nomAffiche(c), fonction });
    }
    return liste;
  }

  private valider(date: string, heure: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || enJour(date).toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('Date invalide.');
    }
    if (!CRENEAUX.includes(heure)) throw new BadRequestException("Heure invalide : choisissez un créneau proposé.");
    const jour = enJour(date).getUTCDay();
    if (jour < 1 || jour > 5) throw new BadRequestException('Les rendez-vous ont lieu du lundi au vendredi.');
    const instant = new Date(`${date}T${heure}:00.000+03:00`);
    const t = Date.now();
    if (instant.getTime() < t + DELAI_MIN_H * 3_600_000) {
      throw new BadRequestException(`Choisissez un créneau au moins ${DELAI_MIN_H} h à l'avance.`);
    }
    if (instant.getTime() > t + HORIZON_J * 86_400_000) {
      throw new BadRequestException(`Les rendez-vous se prennent au plus ${HORIZON_J} jours à l'avance.`);
    }
    return instant;
  }

  async demander(userId: number, dto: DemanderRendezVousDto) {
    const parentId = await parentIdDe(this.prisma, userId);
    const interlocuteur = (await this.interlocuteurs(parentId)).find((i) => i.utilisateurId === dto.interlocuteurId);
    if (!interlocuteur) throw new BadRequestException("Cette personne n'est pas disponible pour vos enfants.");
    const instant = this.valider(dto.date, dto.heure);
    const motif = dto.motif?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.parent.findUnique({ where: { id: parentId }, select: { nom: true, prenom: true } });

      if (await tx.rendezVous.findFirst({ where: { parentId, dateHeure: instant, statut: { in: ACTIFS } } })) {
        throw new ConflictException('Vous avez déjà un rendez-vous à cette heure.');
      }
      if (await tx.rendezVous.findFirst({
        where: { parentId, utilisateurId: interlocuteur.utilisateurId, statut: { in: ACTIFS }, dateHeure: { gte: new Date() } },
      })) {
        throw new ConflictException("Vous avez déjà une demande en cours avec cette personne. Annulez-la avant d'en faire une nouvelle.");
      }
      if (await tx.rendezVous.findFirst({
        where: { utilisateurId: interlocuteur.utilisateurId, dateHeure: instant, statut: StatutRendezVous.CONFIRME },
      })) {
        throw new ConflictException("Ce créneau n'est plus disponible. Choisissez une autre heure.");
      }

      const rdv = await tx.rendezVous.create({
        data: { parentId, utilisateurId: interlocuteur.utilisateurId, dateHeure: instant, motif, statut: StatutRendezVous.DEMANDE },
        select: { id: true, dateHeure: true, statut: true, motif: true },
      });
      await tx.notification.create({
        data: {
          utilisateurId: interlocuteur.utilisateurId,
          message: `Nouvelle demande de rendez-vous de ${`${parent?.prenom ?? ''} ${parent?.nom ?? ''}`.trim()} : ${quand(instant)}.`,
        },
      });
      await tx.journalAudit.create({
        data: {
          utilisateurId: userId, action: 'RENDEZ_VOUS_DEMANDE', entite: 'RendezVous', entiteId: rdv.id,
          details: { interlocuteurId: interlocuteur.utilisateurId, dateHeure: instant.toISOString() },
        },
      });
      return rdv;
    });
  }

  async mesRendezVous(userId: number) {
    const parentId = await parentIdDe(this.prisma, userId);
    const rows = await this.prisma.rendezVous.findMany({
      where: { parentId }, orderBy: { dateHeure: 'desc' }, take: 100,
      select: {
        id: true, dateHeure: true, statut: true, motif: true,
        utilisateur: { select: { role: true, personnel: { select: { nom: true, prenom: true } } } },
      },
    });
    const t = Date.now();
    return rows.map((r) => ({
      id: r.id, dateHeure: r.dateHeure, statut: r.statut, motif: r.motif,
      interlocuteur: nomAffiche(r.utilisateur),
      peutAnnuler: ACTIFS.some((s) => s === r.statut) && r.dateHeure.getTime() > t,
    }));
  }

  async annulerParParent(id: number, userId: number) {
    const parentId = await parentIdDe(this.prisma, userId);
    // Le filtre parentId garantit qu'on ne peut annuler que SES rendez-vous (sinon 404)
    const rdv = await this.prisma.rendezVous.findFirst({
      where: { id, parentId },
      select: { id: true, statut: true, dateHeure: true, utilisateurId: true, parent: { select: { nom: true, prenom: true } } },
    });
    if (!rdv) throw new NotFoundException('Rendez-vous introuvable');
    if (rdv.statut !== StatutRendezVous.DEMANDE && rdv.statut !== StatutRendezVous.CONFIRME) {
      throw new ConflictException('Ce rendez-vous ne peut plus être annulé.');
    }
    if (rdv.dateHeure.getTime() <= Date.now()) throw new BadRequestException('Ce rendez-vous est déjà passé.');

    return this.prisma.$transaction(async (tx) => {
      const r = await tx.rendezVous.updateMany({ where: { id, statut: rdv.statut }, data: { statut: StatutRendezVous.ANNULE } });
      if (r.count === 0) throw new ConflictException('Ce rendez-vous vient d\'être modifié. Actualisez la page.');
      await tx.notification.create({
        data: {
          utilisateurId: rdv.utilisateurId,
          message: `${rdv.parent.prenom} ${rdv.parent.nom} a annulé le rendez-vous du ${quand(rdv.dateHeure)}.`,
        },
      });
      await tx.journalAudit.create({
        data: {
          utilisateurId: userId, action: 'RENDEZ_VOUS_ANNULE_PARENT', entite: 'RendezVous', entiteId: id,
          details: { avant: rdv.statut, apres: 'ANNULE' },
        },
      });
      return { id, statut: StatutRendezVous.ANNULE };
    });
  }

  // ================= CÔTÉ PERSONNEL =================

  async lister(acteur: Acteur, f: FiltresRdv) {
    if (f.statut && !(f.statut in StatutRendezVous)) throw new BadRequestException('Statut invalide.');
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(100, Math.max(1, parseInt(f.taille ?? '25', 10) || 25));
    const statut = f.statut ? (f.statut as StatutRendezVous) : undefined;
    const where = {
      ...(voitTout(acteur.role) ? {} : { utilisateurId: acteur.id }),
      ...(statut ? { statut } : {}),
    };
    const aVenir = statut === StatutRendezVous.DEMANDE || statut === StatutRendezVous.CONFIRME;

    const [total, rows] = await Promise.all([
      this.prisma.rendezVous.count({ where }),
      this.prisma.rendezVous.findMany({
        where, orderBy: { dateHeure: aVenir ? 'asc' : 'desc' }, skip: (page - 1) * taille, take: taille,
        select: {
          id: true, dateHeure: true, statut: true, motif: true,
          utilisateur: { select: { role: true, personnel: { select: { nom: true, prenom: true } } } },
          parent: {
            select: {
              nom: true, prenom: true, telephone: true,
              enfants: { select: { eleve: { select: { prenom: true, nom: true } } } },
            },
          },
        },
      }),
    ]);
    const t = Date.now();
    return {
      total, page, taille,
      lignes: rows.map((r) => ({
        id: r.id, dateHeure: r.dateHeure, statut: r.statut, motif: r.motif,
        interlocuteur: nomAffiche(r.utilisateur),
        parent: { nom: r.parent.nom, prenom: r.parent.prenom, telephone: r.parent.telephone },
        enfants: r.parent.enfants.map((e) => `${e.eleve.prenom} ${e.eleve.nom}`),
        peutTerminer: r.statut === StatutRendezVous.CONFIRME && r.dateHeure.getTime() <= t,
      })),
    };
  }

  private async chargerPourPersonnel(id: number, acteur: Acteur): Promise<RdvCharge> {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id },
      include: { parent: { select: { utilisateur: { select: { id: true, actif: true } } } } },
    });
    // 404 (et non 403) : on ne révèle pas l'existence des rendez-vous d'un collègue
    if (!rdv || (!voitTout(acteur.role) && rdv.utilisateurId !== acteur.id)) throw new NotFoundException('Rendez-vous introuvable');
    return rdv;
  }

  private changer(
    rdv: RdvCharge, statut: StatutRendezVous, acteur: Acteur, messageParent: string, action: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // updateMany avec l'ancien statut : évite une double transition si deux personnes cliquent en même temps
      const r = await tx.rendezVous.updateMany({ where: { id: rdv.id, statut: rdv.statut }, data: { statut } });
      if (r.count === 0) throw new ConflictException("Ce rendez-vous vient d'être modifié. Actualisez la page.");
      if (messageParent && rdv.parent.utilisateur?.actif){
        await tx.notification.create({ data: { utilisateurId: rdv.parent.utilisateur.id, message: messageParent } });
      }
      await tx.journalAudit.create({
        data: {
          utilisateurId: acteur.id, action, entite: 'RendezVous', entiteId: rdv.id,
          details: { avant: rdv.statut, apres: statut },
        },
      });
      return { id: rdv.id, statut };
    });
  }

  async confirmer(id: number, acteur: Acteur) {
    const rdv = await this.chargerPourPersonnel(id, acteur);
    if (rdv.statut !== StatutRendezVous.DEMANDE) throw new ConflictException('Seule une demande en attente peut être confirmée.');
    if (rdv.dateHeure.getTime() <= Date.now()) throw new BadRequestException('Ce créneau est déjà passé.');
    const pris = await this.prisma.rendezVous.findFirst({
      where: { utilisateurId: rdv.utilisateurId, dateHeure: rdv.dateHeure, statut: StatutRendezVous.CONFIRME, id: { not: id } },
    });
    if (pris) throw new ConflictException('Un autre rendez-vous est déjà confirmé à cette heure.');
    return this.changer(rdv, StatutRendezVous.CONFIRME, acteur,
      `Votre rendez-vous du ${quand(rdv.dateHeure)} est confirmé.`, 'RENDEZ_VOUS_CONFIRME');
  }

  async annuler(id: number, acteur: Acteur, dto: RaisonDto) {
    const rdv = await this.chargerPourPersonnel(id, acteur);
    if (rdv.statut !== StatutRendezVous.DEMANDE && rdv.statut !== StatutRendezVous.CONFIRME) {
      throw new ConflictException('Ce rendez-vous ne peut plus être annulé.');
    }
    const raison = dto.raison?.trim();
    const suite = raison ? ` Motif : ${raison}.` : '';
    const message = rdv.statut === StatutRendezVous.DEMANDE
      ? `Votre demande de rendez-vous du ${quand(rdv.dateHeure)} n'a pas pu être acceptée.${suite}`
      : `Votre rendez-vous du ${quand(rdv.dateHeure)} a été annulé par l'école.${suite}`;
    return this.changer(rdv, StatutRendezVous.ANNULE, acteur, message, 'RENDEZ_VOUS_ANNULE_ECOLE');
  }

  async terminer(id: number, acteur: Acteur) {
    const rdv = await this.chargerPourPersonnel(id, acteur);
    if (rdv.statut !== StatutRendezVous.CONFIRME) throw new ConflictException('Seul un rendez-vous confirmé peut être clôturé.');
    if (rdv.dateHeure.getTime() > Date.now()) throw new BadRequestException("Ce rendez-vous n'a pas encore eu lieu.");
    return this.changer(rdv, StatutRendezVous.TERMINE, acteur, '', 'RENDEZ_VOUS_TERMINE');
  }
}
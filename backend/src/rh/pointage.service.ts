import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnnulerPointageDto, CorrigerPointageDto, CreerPointageManuelDto } from './dto/pointage.dto';

const DECALAGE_MS = 3 * 60 * 60 * 1000; // Madagascar : UTC+3, sans heure d'été
const JOUR_MS = 24 * 60 * 60 * 1000;

// 'AAAA-MM-JJ' du jour à Madagascar
const jourLocalIso = (instant = new Date()) => new Date(instant.getTime() + DECALAGE_MS).toISOString().slice(0, 10);
// Valeur d'une colonne @db.Date
const enJour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const estOuvre = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5; // lundi à vendredi
const heureLocale = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Antananarivo' });

@Injectable()
export class PointageService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Lecture ----------

  async presencesDuJour(dateIso?: string) {
    const iso = this.exigerDate(dateIso ?? jourLocalIso());
    const jour = enJour(iso);
    const lendemain = new Date(jour.getTime() + JOUR_MS);

    const agents = await this.prisma.personnel.findMany({
      where: {
        dateEmbauche: { lt: lendemain },
        OR: [{ dateDepart: null }, { dateDepart: { gte: jour } }],
      },
      select: {
        id: true, matricule: true, nom: true, prenom: true, poste: true,
        pointages: { where: { date: jour }, select: { id: true, heureArrivee: true, heureDepart: true } },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });

    return {
      date: iso,
      ouvre: estOuvre(jour),
      agents: agents.map(({ pointages, ...a }) => ({ ...a, pointage: pointages[0] ?? null })),
    };
  }

  async recapMensuel(mois?: string) {
    const m = mois ?? jourLocalIso().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new BadRequestException('Mois invalide (AAAA-MM).');

    const debut = enJour(`${m}-01`);
    const debutSuivant = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1));
    const aujourdhui = enJour(jourLocalIso());
    // Dernier jour pris en compte : fin du mois, ou aujourd'hui si le mois n'est pas terminé
    const derniere = Math.min(debutSuivant.getTime() - JOUR_MS, aujourdhui.getTime());

    const personnel = await this.prisma.personnel.findMany({
      where: {
        dateEmbauche: { lt: debutSuivant },
        OR: [{ dateDepart: null }, { dateDepart: { gte: debut } }],
      },
      select: {
        id: true, matricule: true, nom: true, prenom: true, poste: true,
        dateEmbauche: true, dateDepart: true, indemniteTransportJour: true,
        pointages: { where: { date: { gte: debut, lt: debutSuivant } }, select: { date: true, heureArrivee: true, heureDepart: true } },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });

    let joursOuvresMois = 0;
    for (let t = debut.getTime(); t <= derniere; t += JOUR_MS) if (estOuvre(new Date(t))) joursOuvresMois++;

    const agents = personnel.map((p) => {
      const embauche = enJour(p.dateEmbauche.toISOString().slice(0, 10)).getTime();
      const depart = p.dateDepart ? enJour(p.dateDepart.toISOString().slice(0, 10)).getTime() : Infinity;
      const borneDebut = Math.max(debut.getTime(), embauche);
      const borneFin = Math.min(derniere, depart);

      const ouvres = new Set<string>();
      for (let t = borneDebut; t <= borneFin; t += JOUR_MS) {
        if (estOuvre(new Date(t))) ouvres.add(new Date(t).toISOString().slice(0, 10));
      }

      let joursPresents = 0, presentsOuvres = 0, departsOublies = 0, minutes = 0;
      for (const pt of p.pointages) {
        if (!pt.heureArrivee) continue;
        joursPresents++;
        if (ouvres.has(pt.date.toISOString().slice(0, 10))) presentsOuvres++;
        if (pt.heureDepart) {
          minutes += Math.max(0, Math.round((pt.heureDepart.getTime() - pt.heureArrivee.getTime()) / 60000));
        } else if (pt.date < aujourdhui) {
          departsOublies++;
        }
      }

      return {
        id: p.id, matricule: p.matricule, nom: p.nom, prenom: p.prenom, poste: p.poste,
        joursOuvres: ouvres.size,
        joursPresents,
        absences: Math.max(0, ouvres.size - presentsOuvres),
        departsOublies,
        minutesTravaillees: minutes,
        indemniteTransport: p.indemniteTransportJour ? Number(p.indemniteTransportJour) * joursPresents : null,
      };
    });

    return { mois: m, joursOuvresMois, agents };
  }

  listerPointages(personnelId: number) {
    return this.prisma.pointage.findMany({ where: { personnelId }, orderBy: { date: 'desc' }, take: 200 });
  }

  // ---------- Pointage du jour ----------

  async enregistrerArrivee(personnelId: number) {
    const jour = enJour(jourLocalIso());
    await this.exigerEnPoste(personnelId, jour);

    const existant = await this.prisma.pointage.findFirst({ where: { personnelId, date: jour } });
    if (existant) throw this.dejaPointe(existant.heureArrivee);

    try {
      return await this.prisma.pointage.create({ data: { personnelId, date: jour, heureArrivee: new Date() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw this.dejaPointe(null);
      throw e;
    }
  }

  async enregistrerDepart(pointageId: number) {
    const pt = await this.exiger(pointageId);
    if (pt.date.getTime() !== enJour(jourLocalIso()).getTime()) {
      throw new ConflictException("Ce pointage n'est pas celui d'aujourd'hui. Utilisez « Corriger ».");
    }
    if (!pt.heureArrivee) throw new ConflictException("Aucune arrivée enregistrée : utilisez « Corriger ».");
    if (pt.heureDepart) throw new ConflictException(`Départ déjà enregistré à ${heureLocale(pt.heureDepart)}.`);

    // Conditionné à « heureDepart nul » : un double clic ne peut pas écraser l'heure
    const r = await this.prisma.pointage.updateMany({
      where: { id: pointageId, heureDepart: null },
      data: { heureDepart: new Date() },
    });
    if (r.count === 0) throw new ConflictException('Départ déjà enregistré.');
    return this.exiger(pointageId);
  }

  // ---------- Corrections (ADMIN, motif obligatoire, journalisées) ----------

  async corriger(id: number, dto: CorrigerPointageDto, adminId?: number) {
    const pt = await this.exiger(id);
    const iso = pt.date.toISOString().slice(0, 10);

    const arrivee = dto.heureArrivee ? new Date(dto.heureArrivee) : pt.heureArrivee;
    const depart =
      dto.heureDepart === undefined ? pt.heureDepart : dto.heureDepart === null ? null : new Date(dto.heureDepart);
    if (!arrivee) throw new BadRequestException("L'heure d'arrivée est obligatoire.");
    this.verifierHeures(iso, arrivee, depart);

    return this.prisma.$transaction(async (tx) => {
      const maj = await tx.pointage.update({ where: { id }, data: { heureArrivee: arrivee, heureDepart: depart } });
      await tx.journalAudit.create({
        data: {
          utilisateurId: adminId, action: 'POINTAGE_CORRIGE', entite: 'Pointage', entiteId: id,
          details: {
            personnelId: pt.personnelId, date: iso, motif: dto.motif.trim(),
            avant: { arrivee: pt.heureArrivee?.toISOString() ?? null, depart: pt.heureDepart?.toISOString() ?? null },
            apres: { arrivee: arrivee.toISOString(), depart: depart?.toISOString() ?? null },
          },
        },
      });
      return maj;
    });
  }

  async creerManuel(dto: CreerPointageManuelDto, adminId?: number) {
    const iso = this.exigerDate(dto.date);
    const jour = enJour(iso);
    if (jour.getTime() > enJour(jourLocalIso()).getTime()) {
      throw new BadRequestException('Impossible de pointer un jour futur.');
    }
    await this.exigerEnPoste(dto.personnelId, jour);

    const existant = await this.prisma.pointage.findFirst({ where: { personnelId: dto.personnelId, date: jour } });
    if (existant) throw new ConflictException('Un pointage existe déjà ce jour-là : utilisez « Corriger ».');

    const arrivee = new Date(dto.heureArrivee);
    const depart = dto.heureDepart ? new Date(dto.heureDepart) : null;
    this.verifierHeures(iso, arrivee, depart);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const pt = await tx.pointage.create({
          data: { personnelId: dto.personnelId, date: jour, heureArrivee: arrivee, heureDepart: depart },
        });
        await tx.journalAudit.create({
          data: {
            utilisateurId: adminId, action: 'POINTAGE_SAISI_MANUELLEMENT', entite: 'Pointage', entiteId: pt.id,
            details: { personnelId: dto.personnelId, date: iso, motif: dto.motif.trim() },
          },
        });
        return pt;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Un pointage existe déjà ce jour-là.');
      }
      throw e;
    }
  }

  async annuler(id: number, dto: AnnulerPointageDto, adminId?: number) {
    const pt = await this.exiger(id);
    await this.prisma.$transaction([
      this.prisma.pointage.delete({ where: { id } }),
      this.prisma.journalAudit.create({
        data: {
          utilisateurId: adminId, action: 'POINTAGE_ANNULE', entite: 'Pointage', entiteId: id,
          details: {
            personnelId: pt.personnelId, date: pt.date.toISOString().slice(0, 10), motif: dto.motif.trim(),
            arrivee: pt.heureArrivee?.toISOString() ?? null, depart: pt.heureDepart?.toISOString() ?? null,
          },
        },
      }),
    ]);
    return { message: 'Pointage annulé' };
  }

  // ---------- Outils internes ----------

  private dejaPointe(arrivee: Date | null) {
    return new ConflictException(
      arrivee ? `Arrivée déjà enregistrée à ${heureLocale(arrivee)}.` : 'Cet agent est déjà pointé aujourd\'hui.',
    );
  }

  private exigerDate(iso: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || enJour(iso).toISOString().slice(0, 10) !== iso) {
      throw new BadRequestException('Date invalide (AAAA-MM-JJ).');
    }
    return iso;
  }

  private verifierHeures(iso: string, arrivee: Date, depart: Date | null) {
    if (Number.isNaN(arrivee.getTime()) || (depart && Number.isNaN(depart.getTime()))) {
      throw new BadRequestException('Heure invalide.');
    }
    if (jourLocalIso(arrivee) !== iso) {
      throw new BadRequestException("L'heure d'arrivée doit être dans la journée du pointage.");
    }
    if (depart) {
      if (jourLocalIso(depart) !== iso) throw new BadRequestException('Le départ doit être dans la même journée.');
      if (depart <= arrivee) throw new BadRequestException("Le départ doit être après l'arrivée.");
    }
    const limite = Date.now() + 5 * 60_000;
    if (arrivee.getTime() > limite || (depart && depart.getTime() > limite)) {
      throw new BadRequestException('Une heure ne peut pas être dans le futur.');
    }
  }

  private async exiger(id: number) {
    const pt = await this.prisma.pointage.findUnique({ where: { id } });
    if (!pt) throw new NotFoundException(`Pointage #${id} introuvable`);
    return pt;
  }

  private async exigerEnPoste(personnelId: number, jour: Date) {
    const p = await this.prisma.personnel.findUnique({ where: { id: personnelId } });
    if (!p) throw new NotFoundException(`Personnel #${personnelId} introuvable`);
    if (p.dateEmbauche.getTime() >= jour.getTime() + JOUR_MS) {
      throw new BadRequestException("Cet agent n'est pas encore embauché à cette date.");
    }
    if (p.dateDepart && p.dateDepart < jour) {
      throw new BadRequestException('Cet agent a quitté l\'école avant cette date.');
    }
    return p;
  }
}
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnregistrerJourMenuDto, ModifierPeriodeMenuDto, PeriodeMenuDto } from './dto/communication.dto';

const JOUR_MS = 86_400_000;
const DUREE_MAX_JOURS = 200;
const enJour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const versIso = (d: Date) => d.toISOString().slice(0, 10);
const valide = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = enJour(iso);
  return !Number.isNaN(d.getTime()) && versIso(d) === iso;
};
const aujourdhui = () => versIso(new Date(Date.now() + 3 * 3_600_000)); // Madagascar UTC+3
const ajouter = (iso: string, n: number) => versIso(new Date(enJour(iso).getTime() + n * JOUR_MS));
const estOuvre = (iso: string) => { const j = enJour(iso).getUTCDay(); return j >= 1 && j <= 5; };
const lundiDe = (iso: string) => ajouter(iso, -((enJour(iso).getUTCDay() + 6) % 7));
const propre = (s?: string) => s?.trim() || null;

export interface Acteur { id: number }

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Lecture (tous les rôles) ----------

  async semaine(dateIso?: string) {
    const base = dateIso ?? aujourdhui();
    if (!valide(base)) throw new BadRequestException('Date invalide (AAAA-MM-JJ).');
    const lundi = lundiDe(base);
    const vendredi = ajouter(lundi, 4);

    const [jours, periodes] = await Promise.all([
      this.prisma.jourMenu.findMany({
        where: { date: { gte: enJour(lundi), lte: enJour(vendredi) } },
        select: { date: true, entree: true, platPrincipal: true, dessert: true },
      }),
      this.prisma.periodeMenu.findMany({
        where: { dateDebut: { lte: enJour(vendredi) }, dateFin: { gte: enJour(lundi) } },
        select: { id: true, nom: true, dateDebut: true, dateFin: true },
      }),
    ]);

    return {
      lundi, vendredi,
      jours: [0, 1, 2, 3, 4].map((i) => {
        const date = ajouter(lundi, i);
        const t = enJour(date).getTime();
        const menu = jours.find((j) => versIso(j.date) === date);
        const periode = periodes.find((p) => p.dateDebut.getTime() <= t && p.dateFin.getTime() >= t);
        return {
          date,
          periode: periode ? { id: periode.id, nom: periode.nom } : null,
          menu: menu ? { entree: menu.entree, platPrincipal: menu.platPrincipal, dessert: menu.dessert } : null,
        };
      }),
    };
  }

  // ---------- Gestion des périodes ----------

  async periodes() {
    const rows = await this.prisma.periodeMenu.findMany({
      orderBy: { dateDebut: 'desc' },
      select: { id: true, nom: true, dateDebut: true, dateFin: true, _count: { select: { jours: true } } },
    });
    return rows.map((p) => ({
      id: p.id, nom: p.nom, dateDebut: versIso(p.dateDebut), dateFin: versIso(p.dateFin), nbJours: p._count.jours,
    }));
  }

  private async verifierPeriode(nom: string, debut: string, fin: string, exclureId?: number) {
    if (!valide(debut) || !valide(fin)) throw new BadRequestException('Dates invalides.');
    if (debut > fin) throw new BadRequestException('La date de début doit précéder la date de fin.');
    if ((enJour(fin).getTime() - enJour(debut).getTime()) / JOUR_MS > DUREE_MAX_JOURS) {
      throw new BadRequestException(`Une période dure ${DUREE_MAX_JOURS} jours au maximum.`);
    }
    const id = exclureId ? { not: exclureId } : undefined;
    const chevauche = await this.prisma.periodeMenu.findFirst({
      where: { id, dateDebut: { lte: enJour(fin) }, dateFin: { gte: enJour(debut) } }, select: { nom: true },
    });
    if (chevauche) throw new ConflictException(`Ces dates chevauchent la période « ${chevauche.nom} ».`);
    const memeNom = await this.prisma.periodeMenu.findFirst({
      where: { id, nom: { equals: nom, mode: 'insensitive' } }, select: { id: true },
    });
    if (memeNom) throw new ConflictException('Une période porte déjà ce nom.');
  }

  async creerPeriode(dto: PeriodeMenuDto, acteur: Acteur) {
    const nom = dto.nom.trim();
    await this.verifierPeriode(nom, dto.dateDebut, dto.dateFin);
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.periodeMenu.create({ data: { nom, dateDebut: enJour(dto.dateDebut), dateFin: enJour(dto.dateFin) } });
      await tx.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'MENU_PERIODE_CREEE', entite: 'PeriodeMenu', entiteId: p.id, details: { nom, debut: dto.dateDebut, fin: dto.dateFin } },
      });
      return { id: p.id };
    });
  }

  async modifierPeriode(id: number, dto: ModifierPeriodeMenuDto, acteur: Acteur) {
    const p = await this.prisma.periodeMenu.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Période introuvable');
    if (dto.nom === undefined && dto.dateDebut === undefined && dto.dateFin === undefined) {
      throw new BadRequestException('Aucune modification à enregistrer.');
    }
    const nom = dto.nom?.trim() ?? p.nom;
    const debut = dto.dateDebut ?? versIso(p.dateDebut);
    const fin = dto.dateFin ?? versIso(p.dateFin);
    await this.verifierPeriode(nom, debut, fin, id);

    const dehors = await this.prisma.jourMenu.count({
      where: { periodeMenuId: id, OR: [{ date: { lt: enJour(debut) } }, { date: { gt: enJour(fin) } }] },
    });
    if (dehors > 0) throw new ConflictException(`${dehors} jour(s) du menu sortiraient de la période. Supprimez-les d'abord.`);

    await this.prisma.$transaction([
      this.prisma.periodeMenu.update({ where: { id }, data: { nom, dateDebut: enJour(debut), dateFin: enJour(fin) } }),
      this.prisma.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'MENU_PERIODE_MODIFIEE', entite: 'PeriodeMenu', entiteId: id, details: { nom, debut, fin } },
      }),
    ]);
    return { id };
  }

  async supprimerPeriode(id: number, acteur: Acteur) {
    const p = await this.prisma.periodeMenu.findUnique({ where: { id }, select: { nom: true } });
    if (!p) throw new NotFoundException('Période introuvable');
    const nbJours = await this.prisma.jourMenu.count({ where: { periodeMenuId: id } });
    await this.prisma.$transaction([
      this.prisma.jourMenu.deleteMany({ where: { periodeMenuId: id } }),
      this.prisma.periodeMenu.delete({ where: { id } }),
      this.prisma.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'MENU_PERIODE_SUPPRIMEE', entite: 'PeriodeMenu', entiteId: id, details: { nom: p.nom, joursSupprimes: nbJours } },
      }),
    ]);
    return { message: 'Période supprimée' };
  }

  // ---------- Gestion des jours ----------

  async enregistrerJour(periodeId: number, dto: EnregistrerJourMenuDto, acteur: Acteur) {
    const p = await this.prisma.periodeMenu.findUnique({ where: { id: periodeId } });
    if (!p) throw new NotFoundException('Période introuvable');
    if (!valide(dto.date)) throw new BadRequestException('Date invalide.');
    if (dto.date < versIso(p.dateDebut) || dto.date > versIso(p.dateFin)) {
      throw new BadRequestException(`Cette date est hors de la période « ${p.nom} ».`);
    }
    if (!estOuvre(dto.date)) throw new BadRequestException('Le menu se renseigne du lundi au vendredi.');

    const entree = propre(dto.entree);
    const platPrincipal = propre(dto.platPrincipal);
    const dessert = propre(dto.dessert);
    if (!entree && !platPrincipal && !dessert) throw new BadRequestException('Renseignez au moins un plat.');

    // upsert sur (période, date) : enregistrer deux fois le même jour met à jour, ne duplique jamais
    await this.prisma.$transaction([
      this.prisma.jourMenu.upsert({
        where: { periodeMenuId_date: { periodeMenuId: periodeId, date: enJour(dto.date) } },
        create: { periodeMenuId: periodeId, date: enJour(dto.date), entree, platPrincipal, dessert },
        update: { entree, platPrincipal, dessert },
      }),
      this.prisma.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'MENU_JOUR_ENREGISTRE', entite: 'PeriodeMenu', entiteId: periodeId, details: { date: dto.date } },
      }),
    ]);
    return { message: 'Menu enregistré' };
  }

  async supprimerJour(periodeId: number, date: string, acteur: Acteur) {
    if (!valide(date)) throw new BadRequestException('Date invalide.');
    const r = await this.prisma.jourMenu.deleteMany({ where: { periodeMenuId: periodeId, date: enJour(date) } });
    if (r.count === 0) throw new NotFoundException('Aucun menu à cette date');
    await this.prisma.journalAudit.create({
      data: { utilisateurId: acteur.id, action: 'MENU_JOUR_SUPPRIME', entite: 'PeriodeMenu', entiteId: periodeId, details: { date } },
    });
    return { message: 'Menu supprimé' };
  }
}
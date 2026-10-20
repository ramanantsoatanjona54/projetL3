import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Nom de la colonne « date » dans model JournalAudit (schema.prisma).
// Si elle s'appelle autrement chez vous, changez uniquement cette ligne.
const CHAMP_DATE = 'dateAction';
const DECALAGE = '+03:00'; // Madagascar
const JOUR_MS = 86_400_000;

export interface FiltresAudit {
  page?: string; taille?: string; action?: string; entite?: string;
  utilisateurId?: string; q?: string; du?: string; au?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private exigerJour(v: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T00:00:00${DECALAGE}`).getTime())) {
      throw new BadRequestException('Date invalide (AAAA-MM-JJ).');
    }
  }

  private details(v: unknown) {
    if (typeof v !== 'string') return v ?? null;
    try { return JSON.parse(v); } catch { return v; }
  }

  // Ajoute l'auteur (email, rôle) sans exposer d'autre donnée du compte
  private async enrichir(rows: object[]) {
    const brutes = rows as Array<Record<string, any>>;
    const ids = Array.from(new Set(brutes.map((r) => r.utilisateurId).filter((x): x is number => typeof x === 'number')));
    const users = ids.length
      ? await this.prisma.utilisateur.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, role: true } })
      : [];
    const parId = new Map(users.map((u) => [u.id, u]));
    return brutes.map((r) => ({
      id: r.id as number,
      date: (r[CHAMP_DATE] ?? null) as Date | null,
      utilisateur: parId.get(r.utilisateurId) ?? null,
      action: r.action as string,
      entite: (r.entite ?? null) as string | null,
      entiteId: (r.entiteId ?? null) as number | null,
      details: this.details(r.details),
    }));
  }

  async lister(f: FiltresAudit) {
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(100, Math.max(1, parseInt(f.taille ?? '25', 10) || 25));

    const conds: Prisma.JournalAuditWhereInput[] = [];
    if (f.action) conds.push({ action: f.action });
    if (f.entite) conds.push({ entite: f.entite });
    if (f.utilisateurId) {
      const id = Number(f.utilisateurId);
      if (!Number.isInteger(id)) throw new BadRequestException('Utilisateur invalide.');
      conds.push({ utilisateurId: id });
    }
    const q = f.q?.trim();
    if (q) {
      conds.push({
        OR: [
          { action: { contains: q, mode: 'insensitive' } },
          { entite: { contains: q, mode: 'insensitive' } },
          ...(/^\d+$/.test(q) ? [{ entiteId: Number(q) }] : []),
        ],
      });
    }
    const periode: Record<string, Date> = {};
    if (f.du) { this.exigerJour(f.du); periode.gte = new Date(`${f.du}T00:00:00${DECALAGE}`); }
    if (f.au) { this.exigerJour(f.au); periode.lt = new Date(new Date(`${f.au}T00:00:00${DECALAGE}`).getTime() + JOUR_MS); }
    if (periode.gte || periode.lt) conds.push({ [CHAMP_DATE]: periode } as Prisma.JournalAuditWhereInput);

    const where: Prisma.JournalAuditWhereInput = conds.length ? { AND: conds } : {};
    const [total, rows] = await Promise.all([
      this.prisma.journalAudit.count({ where }),
      this.prisma.journalAudit.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * taille, take: taille }),
    ]);

    return { total, page, taille, lignes: await this.enrichir(rows) };
  }

  async recentes(n: number) {
    const rows = await this.prisma.journalAudit.findMany({ orderBy: { id: 'desc' }, take: n });
    return this.enrichir(rows);
  }

  // Valeurs proposées dans les filtres de l'écran
  async filtres() {
    const [actions, entites, auteurs] = await Promise.all([
      this.prisma.journalAudit.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
      this.prisma.journalAudit.findMany({ distinct: ['entite'], select: { entite: true }, orderBy: { entite: 'asc' } }),
      this.prisma.journalAudit.findMany({ distinct: ['utilisateurId'], where: { utilisateurId: { not: null } }, select: { utilisateurId: true } }),
    ]);
    const ids = auteurs.map((a) => a.utilisateurId).filter((x): x is number => typeof x === 'number');
    const utilisateurs = ids.length
      ? await this.prisma.utilisateur.findMany({ where: { id: { in: ids } }, select: { id: true, email: true }, orderBy: { email: 'asc' } })
      : [];
    return {
      actions: actions.map((a) => a.action),
      entites: entites.map((e) => e.entite).filter((e): e is string => !!e),
      utilisateurs,
    };
  }
}
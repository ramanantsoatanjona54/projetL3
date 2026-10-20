import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleUtilisateur, TypeCertificat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { UpdatePersonnelDto } from './dto/update-personnel.dto';
import { DepartPersonnelDto } from './dto/depart-personnel.dto';
import { POSTES } from './postes';

// Le compte lié est renvoyé sans aucune donnée secrète
const INCLUDE_PERSONNEL = {
  salleAffectee: true,
  utilisateur: { select: { id: true, email: true, role: true, actif: true } },
} satisfies Prisma.PersonnelInclude;

const normaliser = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// undefined = non fourni ; null ou vide = effacer ; sinon texte nettoyé
const texte = (v?: string | null) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === '' ? null : t;
};
const cinNormalise = (v?: string | null) => {
  const t = texte(v);
  return typeof t === 'string' ? t.replace(/[\s.\-]/g, '').toUpperCase() : t;
};
const enDate = (v?: string | null) => (v === undefined ? undefined : v === null || v === '' ? null : new Date(v));
const valeur = (v: unknown) => (v === undefined || v === null ? null : v instanceof Date ? v.getTime() : String(v));

@Injectable()
export class RhService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Personnel ---

  listerPostes() {
    return [...POSTES];
  }

  listerPersonnel() {
    return this.prisma.personnel.findMany({
      include: INCLUDE_PERSONNEL,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async obtenirPersonnel(id: number) {
    const p = await this.prisma.personnel.findUnique({ where: { id }, include: INCLUDE_PERSONNEL });
    if (!p) throw new NotFoundException(`Personnel #${id} introuvable`);
    return p;
  }

  private construireDonnees(dto: Partial<CreatePersonnelDto>) {
    return {
      nom: dto.nom?.trim(),
      prenom: dto.prenom?.trim(),
      sexe: texte(dto.sexe),
      dateNaissance: enDate(dto.dateNaissance),
      cin: cinNormalise(dto.cin),
      adresse: texte(dto.adresse),
      telephone: texte(dto.telephone),
      indemniteTransportJour: dto.indemniteTransportJour,
      numeroCnaps: texte(dto.numeroCnaps),
      poste: dto.poste ?? undefined,
      salleAffecteeId: dto.salleAffecteeId,
      lieuAffectation: texte(dto.lieuAffectation),
      autorisationEnseigner: dto.autorisationEnseigner ?? undefined,
      banque: texte(dto.banque),
      dateEmbauche: dto.dateEmbauche ? new Date(dto.dateEmbauche) : undefined,
      dateDepart: enDate(dto.dateDepart),
      dateRetraite: enDate(dto.dateRetraite),
    };
  }

  // Règles de cohérence communes à la création et à la modification
  private async verifier(
    f: {
      nom: string; prenom: string; dateNaissance: Date | null; cin: string | null;
      dateEmbauche: Date; dateDepart: Date | null; salleAffecteeId?: number | null;
    },
    ignorerId?: number,
  ) {
    if (!f.nom || !f.prenom) throw new BadRequestException('Le nom et le prénom sont obligatoires.');
    if (f.dateNaissance && f.dateNaissance > new Date()) {
      throw new BadRequestException('La date de naissance ne peut pas être dans le futur.');
    }
    if (f.dateDepart && f.dateDepart < f.dateEmbauche) {
      throw new BadRequestException("La date de départ ne peut pas précéder la date d'embauche.");
    }
    if (f.salleAffecteeId) {
      const salle = await this.prisma.salle.findUnique({ where: { id: f.salleAffecteeId } });
      if (!salle) throw new NotFoundException(`Salle #${f.salleAffecteeId} introuvable`);
    }

    const autreId = ignorerId ? { id: { not: ignorerId } } : {};

    if (f.cin) {
      const existant = await this.prisma.personnel.findFirst({ where: { cin: f.cin, ...autreId } });
      if (existant) {
        throw new ConflictException(
          `Ce CIN est déjà enregistré pour ${existant.prenom} ${existant.nom} (${existant.matricule}).`,
        );
      }
    }

    // Même personne : même nom + prénom (sans accents ni casse) + même date de naissance
    if (f.dateNaissance) {
      const candidats = await this.prisma.personnel.findMany({
        where: { dateNaissance: f.dateNaissance, ...autreId },
        select: { nom: true, prenom: true, matricule: true },
      });
      const cle = normaliser(`${f.nom} ${f.prenom}`);
      const doublon = candidats.find((c) => normaliser(`${c.nom} ${c.prenom}`) === cle);
      if (doublon) {
        throw new ConflictException(
          `Cette personne existe déjà (${doublon.prenom} ${doublon.nom}, ${doublon.matricule}).`,
        );
      }
    }
  }

  // Dernier matricule de l'année + 1 (jamais un count, qui se décale après une suppression)
  private async prochainMatricule(tx: Prisma.TransactionClient): Promise<string> {
    const prefixe = `PER-${new Date().getFullYear()}-`;
    const dernier = await tx.personnel.findFirst({
      where: { matricule: { startsWith: prefixe } },
      orderBy: { matricule: 'desc' },
      select: { matricule: true },
    });
    const n = dernier ? parseInt(dernier.matricule.slice(prefixe.length), 10) : 0;
    return `${prefixe}${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, '0')}`;
  }

  async creerPersonnel(dto: CreatePersonnelDto, adminId?: number) {
    const d = this.construireDonnees(dto);
    const nom = d.nom as string;
    const prenom = d.prenom as string;
    const dateEmbauche = d.dateEmbauche as Date;

    await this.verifier({
      nom, prenom, dateNaissance: d.dateNaissance ?? null, cin: d.cin ?? null,
      dateEmbauche, dateDepart: d.dateDepart ?? null, salleAffecteeId: d.salleAffecteeId,
    });

    // Plusieurs tentatives : deux créations simultanées peuvent viser le même matricule
    for (let tentative = 0; tentative < 3; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const matricule = await this.prochainMatricule(tx);
          const p = await tx.personnel.create({
            data: { ...d, matricule, nom, prenom, poste: d.poste as string, dateEmbauche },
            include: INCLUDE_PERSONNEL,
          });
          await tx.journalAudit.create({
            data: {
              utilisateurId: adminId, action: 'PERSONNEL_CREE', entite: 'Personnel', entiteId: p.id,
              details: { matricule: p.matricule, poste: p.poste },
            },
          });
          return p;
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const cible = JSON.stringify(e.meta?.target ?? '');
          if (cible.includes('cin')) throw new ConflictException('Ce CIN est déjà enregistré.');
          if (cible.includes('matricule')) continue;
        }
        throw e;
      }
    }
    throw new ConflictException('Impossible de générer un matricule, réessayez.');
  }

  async modifierPersonnel(id: number, dto: UpdatePersonnelDto, adminId?: number) {
    const actuel = await this.obtenirPersonnel(id);
    const d = this.construireDonnees(dto);

    await this.verifier(
      {
        nom: d.nom ?? actuel.nom,
        prenom: d.prenom ?? actuel.prenom,
        dateNaissance: d.dateNaissance === undefined ? actuel.dateNaissance : d.dateNaissance,
        cin: d.cin === undefined ? actuel.cin : d.cin,
        dateEmbauche: d.dateEmbauche ?? actuel.dateEmbauche,
        dateDepart: d.dateDepart === undefined ? actuel.dateDepart : d.dateDepart,
        salleAffecteeId: d.salleAffecteeId,
      },
      id,
    );

    // Seuls les NOMS des champs réellement modifiés sont journalisés (pas de CIN, banque, CNAPS...)
    const champsModifies = (Object.keys(d) as (keyof typeof d)[]).filter(
      (k) => d[k] !== undefined && valeur(d[k]) !== valeur(actuel[k]),
    );
    if (champsModifies.length === 0) return actuel;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const p = await tx.personnel.update({ where: { id }, data: d, include: INCLUDE_PERSONNEL });
        await tx.journalAudit.create({
          data: {
            utilisateurId: adminId, action: 'PERSONNEL_MODIFIE', entite: 'Personnel', entiteId: id,
            details: { matricule: actuel.matricule, champsModifies },
          },
        });
        return p;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ce CIN est déjà enregistré.');
      }
      throw e;
    }
  }

  async enregistrerDepartPersonnel(id: number, dto: DepartPersonnelDto, adminId?: number) {
    const p = await this.obtenirPersonnel(id);
    const dateDepart = new Date(dto.dateDepart);

    if (p.dateDepart) {
      throw new ConflictException('Un départ est déjà enregistré. Corrigez la date depuis « Modifier ».');
    }
    if (dateDepart < p.dateEmbauche) {
      throw new BadRequestException("La date de départ ne peut pas précéder la date d'embauche.");
    }

    const compte = p.utilisateur;
    const desactiver = !!dto.desactiverCompte && !!compte && compte.actif;
    if (desactiver && compte) {
      if (compte.id === adminId) {
        throw new ConflictException('Vous ne pouvez pas désactiver votre propre compte.');
      }
      if (compte.role === RoleUtilisateur.ADMIN) {
        const autres = await this.prisma.utilisateur.count({
          where: { role: RoleUtilisateur.ADMIN, actif: true, id: { not: compte.id } },
        });
        if (autres === 0) throw new ConflictException('Il doit rester au moins un administrateur actif.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.personnel.update({ where: { id }, data: { dateDepart } });
      if (desactiver && compte) {
        await tx.utilisateur.update({ where: { id: compte.id }, data: { actif: false } });
        await tx.journalAudit.create({
          data: {
            utilisateurId: adminId, action: 'UTILISATEUR_MODIFIE', entite: 'Utilisateur', entiteId: compte.id,
            details: { motif: 'Départ du personnel', apres: { actif: false } },
          },
        });
      }
      await tx.journalAudit.create({
        data: {
          utilisateurId: adminId, action: 'PERSONNEL_DEPART', entite: 'Personnel', entiteId: id,
          details: { matricule: p.matricule, dateDepart: dto.dateDepart, compteDesactive: desactiver },
        },
      });
    });

    return { ...(await this.obtenirPersonnel(id)), compteDesactive: desactiver };
  }

  

  // --- Certificats / contrats ---

  genererCertificat(personnelId: number, type: TypeCertificat, contenu: string) {
    return this.prisma.certificatTravail.create({ data: { personnelId, type, contenu } });
  }
}
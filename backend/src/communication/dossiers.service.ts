import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { DeposerDossierDto } from './dto/communication.dto';

// Emplacement des fichiers : HORS de tout dossier public, jamais servi directement
const RACINE = process.env.DOSSIERS_DIR ?? join(process.cwd(), 'storage', 'dossiers');
export const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo

const estZip = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const estJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const REGLES: Record<string, { mime: string; signatureOk: (b: Buffer) => boolean }> = {
  pdf: { mime: 'application/pdf', signatureOk: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  png: { mime: 'image/png', signatureOk: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: 'image/jpeg', signatureOk: estJpeg },
  jpeg: { mime: 'image/jpeg', signatureOk: estJpeg },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', signatureOk: estZip },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', signatureOk: estZip },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', signatureOk: estZip },
};
// Clé de stockage générée par nous : protège contre toute tentative de « ../ »
const CLE_VALIDE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|jpeg|docx|xlsx|pptx)$/;

export interface FichierEnvoye { originalname: string; buffer: Buffer; size: number; mimetype: string }
export interface Acteur { id: number; role: RoleUtilisateur }
export interface FiltresDossiers { page?: string; taille?: string; q?: string; type?: string }

// Types de documents visibles par rôle (moindre privilège). Un document sans type est traité comme « Autre ».
const TOUS_TYPES = ['Circulaire', 'Support de cours', 'Administratif', 'Autre'];
const TYPES_PAR_ROLE: Record<string, string[]> = {
  ADMIN: TOUS_TYPES,
  DIRECTRICE: TOUS_TYPES,
  SECRETARIAT: ['Circulaire', 'Administratif', 'Autre'],
  COMPTABLE: ['Circulaire', 'Administratif', 'Autre'],
  ENSEIGNANT: ['Circulaire', 'Support de cours', 'Autre'],
};
const typesVisibles = (role: RoleUtilisateur): string[] => TYPES_PAR_ROLE[role] ?? [];

// Multer lit parfois les noms accentués en latin1 : on rétablit l'UTF-8
function corrigerNom(brut: string): string {
  const converti = Buffer.from(brut, 'latin1').toString('utf8');
  const nom = converti.includes('\uFFFD') ? brut : converti;
  return nom.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(-120);
}

@Injectable()
export class DossiersService {
  constructor(private readonly prisma: PrismaService) {}

  async deposer(fichier: FichierEnvoye | undefined, dto: DeposerDossierDto, acteur: Acteur) {
    if (!fichier || !fichier.buffer || fichier.size === 0) throw new BadRequestException('Aucun fichier reçu.');
    if (fichier.size > TAILLE_MAX) throw new BadRequestException('Fichier trop volumineux (10 Mo maximum).');

    const nomOriginal = corrigerNom(fichier.originalname);
    const ext = nomOriginal.includes('.') ? nomOriginal.split('.').pop()!.toLowerCase() : '';
    const regle = REGLES[ext];
    if (!regle) throw new BadRequestException('Format non accepté. Formats permis : PDF, Word, Excel, PowerPoint, PNG, JPEG.');
    if (!regle.signatureOk(fichier.buffer)) throw new BadRequestException("Le contenu du fichier ne correspond pas à son extension.");

    const titre = dto.titre.trim();
    if (titre.length < 3) throw new BadRequestException('Titre trop court.');
        if (dto.type && !typesVisibles(acteur.role).includes(dto.type)) {
      throw new ForbiddenException(`Votre rôle ne peut pas déposer de document de type « ${dto.type} ».`);
    }

    // ---- Anti-doublons : même titre, même contenu ----
    if (await this.prisma.dossierPartage.findFirst({ where: { titre: { equals: titre, mode: 'insensitive' } }, select: { id: true } })) {
      throw new ConflictException('Un document porte déjà ce titre.');
    }
    const empreinte = createHash('sha256').update(fichier.buffer).digest('hex');
    const memeContenu = await this.prisma.dossierPartage.findUnique({ where: { empreinte }, select: { titre: true } });
    if (memeContenu) throw new ConflictException(`Ce fichier est déjà déposé sous le titre « ${memeContenu.titre} ».`);

    // ---- Écriture sous un nom aléatoire, puis ligne en base (nettoyage si la base refuse) ----
    const cle = `${randomUUID()}.${ext}`;
    await mkdir(RACINE, { recursive: true });
    await writeFile(join(RACINE, cle), fichier.buffer, { flag: 'wx' });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const d = await tx.dossierPartage.create({
          data: {
            titre, type: dto.type ?? null, fichierUrl: cle, nomOriginal, mime: regle.mime,
            taille: fichier.size, empreinte, deposeParId: acteur.id,
          },
          select: { id: true, titre: true },
        });
        await tx.journalAudit.create({
          data: {
            utilisateurId: acteur.id, action: 'DOSSIER_DEPOSE', entite: 'DossierPartage', entiteId: d.id,
            details: { titre, taille: fichier.size, format: ext },
          },
        });
        return d;
      });
    } catch (e) {
      await unlink(join(RACINE, cle)).catch(() => undefined);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ce fichier est déjà déposé.');
      }
      throw e;
    }
  }

    async lister(acteur: Acteur, f: FiltresDossiers) {
    const page = Math.max(1, parseInt(f.page ?? '1', 10) || 1);
    const taille = Math.min(50, Math.max(1, parseInt(f.taille ?? '15', 10) || 15));
    const q = f.q?.trim();
    const visibles = typesVisibles(acteur.role);
    const accessible: Prisma.DossierPartageWhereInput = {
      OR: [{ type: { in: visibles } }, ...(visibles.includes('Autre') ? [{ type: null }] : [])],
    };
    const where: Prisma.DossierPartageWhereInput = {
      AND: [
        accessible,
        ...(f.type ? [{ type: f.type }] : []),
        ...(q ? [{ OR: [{ titre: { contains: q, mode: 'insensitive' as const } }, { nomOriginal: { contains: q, mode: 'insensitive' as const } }] }] : []),
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.dossierPartage.count({ where }),
      this.prisma.dossierPartage.findMany({
        where, orderBy: [{ dateDepot: 'desc' }, { id: 'desc' }], skip: (page - 1) * taille, take: taille,
        select: {
          id: true, titre: true, type: true, dateDepot: true, nomOriginal: true, mime: true, taille: true, empreinte: true,
          deposeParId: true,
          deposePar: { select: { email: true, personnel: { select: { nom: true, prenom: true } } } },
        },
      }),
    ]);
    const direction = acteur.role === RoleUtilisateur.ADMIN || acteur.role === RoleUtilisateur.DIRECTRICE;
    return {
      total, page, taille, typesAutorises: visibles,
      lignes: rows.map((d) => ({
        id: d.id, titre: d.titre, type: d.type, date: d.dateDepot,
        nomOriginal: d.nomOriginal, mime: d.mime, taille: d.taille,
        aFichier: !!d.empreinte,
        deposePar: d.deposePar ? (d.deposePar.personnel ? `${d.deposePar.personnel.prenom} ${d.deposePar.personnel.nom}` : d.deposePar.email) : null,
        peutSupprimer: direction || d.deposeParId === acteur.id,
      })),
    };
  }

      async ouvrir(id: number, acteur: Acteur) {
    const d = await this.prisma.dossierPartage.findUnique({
      where: { id }, select: { fichierUrl: true, nomOriginal: true, mime: true, empreinte: true, type: true },
    });
    if (!d || !d.empreinte || !d.nomOriginal || !d.mime || !CLE_VALIDE.test(d.fichierUrl)) {
      throw new NotFoundException('Fichier non disponible');
    }
    // Type interdit pour ce rôle : même réponse que si le fichier n'existait pas (rien n'est révélé)
    if (!typesVisibles(acteur.role).includes(d.type ?? 'Autre')) throw new NotFoundException('Fichier non disponible');
    const chemin = join(RACINE, d.fichierUrl);
    const infos = await stat(chemin).catch(() => null);
    if (!infos) throw new NotFoundException('Fichier introuvable sur le serveur');
    return { flux: createReadStream(chemin), mime: d.mime, nom: d.nomOriginal, taille: infos.size };
  }

  async supprimer(id: number, acteur: Acteur) {
    const d = await this.prisma.dossierPartage.findUnique({
      where: { id }, select: { titre: true, fichierUrl: true, deposeParId: true },
    });
    if (!d) throw new NotFoundException('Document introuvable');
    const direction = acteur.role === RoleUtilisateur.ADMIN || acteur.role === RoleUtilisateur.DIRECTRICE;
    if (!direction && d.deposeParId !== acteur.id) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres documents.');
    }
    await this.prisma.$transaction([
      this.prisma.dossierPartage.delete({ where: { id } }),
      this.prisma.journalAudit.create({
        data: { utilisateurId: acteur.id, action: 'DOSSIER_SUPPRIME', entite: 'DossierPartage', entiteId: id, details: { titre: d.titre } },
      }),
    ]);
    if (CLE_VALIDE.test(d.fichierUrl)) await unlink(join(RACINE, d.fichierUrl)).catch(() => undefined);
    return { message: 'Document supprimé' };
  }
}
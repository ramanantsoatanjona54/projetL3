import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenererDocumentDto } from './dto/documents-rh.dto';
import {
  DonneesDocument, MODELES_DOCUMENT, ModeleDocument, NOMS_FICHIER, construireDocument,
} from './documents-rh.builder';

const enJour = (s: string) => new Date(`${s}T00:00:00.000Z`);
const valide = (s: string) => enJour(s).toISOString().slice(0, 10) === s;
const jourMada = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10); // UTC+3
const propre = (s?: string) => { const v = s?.trim(); return v ? v : null; };

@Injectable()
export class DocumentsRhService {
  constructor(private readonly prisma: PrismaService) {}

  async generer(personnelId: number, modeleBrut: string, dto: GenererDocumentDto, acteurId: number) {
    if (!(MODELES_DOCUMENT as string[]).includes(modeleBrut)) throw new NotFoundException('Modèle de document inconnu.');
    const modele = modeleBrut as ModeleDocument;

    const p = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
      select: {
        matricule: true, nom: true, prenom: true, sexe: true, cin: true, adresse: true, poste: true,
        dateNaissance: true, dateEmbauche: true, dateDepart: true, indemniteTransportJour: true,
      },
    });
    if (!p) throw new NotFoundException('Agent introuvable.');

    // Champs indispensables selon le modèle (le reste est omis proprement du document)
    if (modele === 'contrat' || modele === 'avenant') {
      if (dto.salaireBase === undefined) throw new BadRequestException('Le salaire mensuel de base est obligatoire.');
    }
    if (modele === 'contrat' && !propre(dto.classification)) throw new BadRequestException('La classification (ex. 4B) est obligatoire pour le contrat.');
    if (modele === 'avenant') {
      if (!dto.dateEffet) throw new BadRequestException('La date d’effet est obligatoire pour l’avenant.');
      if (dto.anciennete === undefined) throw new BadRequestException('Le montant de l’ancienneté est obligatoire (0 si aucun).');
    }
    if (modele === 'attestation' && !p.dateEmbauche) throw new BadRequestException('Cet agent n’a pas de date d’embauche : renseignez-la dans sa fiche.');
    if (modele === 'contrat' && !(dto.dateEffet || p.dateEmbauche)) throw new BadRequestException('Indiquez la date de prise de service.');

    for (const d of [dto.dateEffet, dto.dateSignature]) {
      if (d && !valide(d)) throw new BadRequestException('Date invalide.');
    }

    const donnees: DonneesDocument = {
      nom: p.nom, prenom: p.prenom, feminin: String(p.sexe ?? '').toUpperCase().startsWith('F'),
      matricule: p.matricule, cin: propre(p.cin ?? undefined), adresse: propre(p.adresse ?? undefined),
      poste: String(p.poste ?? ''),
      dateNaissance: p.dateNaissance ?? null, dateEmbauche: p.dateEmbauche ?? null, dateDepart: p.dateDepart ?? null,
      transportJour: Number(p.indemniteTransportJour ?? 0),
      nationalite: propre(dto.nationalite) ?? 'malgache',
      lieuNaissance: propre(dto.lieuNaissance), cinDelivrance: propre(dto.cinDelivrance),
      pere: propre(dto.pere), mere: propre(dto.mere), classification: propre(dto.classification),
      dateEffet: dto.dateEffet ? enJour(dto.dateEffet) : null,
      salaireBase: dto.salaireBase ?? null, anciennete: dto.anciennete ?? null,
      natureContrat: dto.natureContrat ?? 'CDI',
      dateSignature: enJour(dto.dateSignature ?? jourMada()),
    };

    const buffer = await construireDocument(modele, donnees);

    // Traçabilité : qui a produit quel document pour quel agent (aucun montant dans le journal)
    await this.prisma.journalAudit.create({
      data: { utilisateurId: acteurId, action: 'DOCUMENT_RH_GENERE', entite: 'Personnel', entiteId: personnelId, details: { modele } },
    });

    const nom = `${NOMS_FICHIER[modele]} - ${p.prenom} ${p.nom}.docx`;
    const nomAscii = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
    return { buffer, nom, nomAscii };
  }
}
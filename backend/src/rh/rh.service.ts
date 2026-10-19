import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { TypeCertificat } from '@prisma/client';

@Injectable()
export class RhService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Personnel ---

  listerPersonnel() {
    return this.prisma.personnel.findMany();
  }

  private async genererMatricule(): Promise<string> {
    const annee = new Date().getFullYear();
    const count = await this.prisma.personnel.count();
    return `PER-${annee}-${String(count + 1).padStart(4, '0')}`;
  }

  // NB: CreatePersonnelDto doit contenir au minimum nom, prenom, poste, dateEmbauche
  // (le matricule est généré automatiquement ici, pas saisi par l'utilisateur)
  // Les champs date (dateNaissance, dateDepart, dateRetraite) arrivent en string
  // ISO-date depuis le DTO : Prisma exige un DateTime complet, d'où la conversion.
  async creerPersonnel(dto: CreatePersonnelDto) {
    const matricule = await this.genererMatricule();
    return this.prisma.personnel.create({
      data: {
        ...dto,
        matricule,
        dateEmbauche: new Date(dto.dateEmbauche),
        dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : undefined,
        dateDepart: dto.dateDepart ? new Date(dto.dateDepart) : undefined,
        dateRetraite: dto.dateRetraite ? new Date(dto.dateRetraite) : undefined,
      },
    });
  }

  // --- Pointage ---

  enregistrerArrivee(personnelId: number) {
    return this.prisma.pointage.create({
      data: { personnelId, date: new Date(), heureArrivee: new Date() },
    });
  }

  enregistrerDepart(pointageId: number) {
    return this.prisma.pointage.update({
      where: { id: pointageId },
      data: { heureDepart: new Date() },
    });
  }

  listerPointages(personnelId: number) {
    return this.prisma.pointage.findMany({ where: { personnelId }, orderBy: { date: 'desc' } });
  }

  // --- Fiche de paie ---

  async calculerSalaireNet(
    personnelId: number,
    mois: number,
    annee: number,
    salaireBrut: number,
    deductions = 0,
  ) {
    const salaireNet = salaireBrut - deductions;
    return this.prisma.ficheDePaie.create({
      data: { personnelId, mois, annee, salaireBrut, salaireNet },
    });
  }

  listerFichesDePaie(personnelId: number) {
    return this.prisma.ficheDePaie.findMany({ where: { personnelId }, orderBy: { mois: 'desc' } });
  }

  // --- Certificats / contrats ---

  genererCertificat(personnelId: number, type: TypeCertificat, contenu: string) {
    return this.prisma.certificatTravail.create({ data: { personnelId, type, contenu } });
  }
}
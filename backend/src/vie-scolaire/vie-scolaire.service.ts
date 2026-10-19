import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TypeInventaire, StatutRendezVous } from '@prisma/client';

@Injectable()
export class VieScolaireService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Emploi du temps ---

  async creerCreneauEDT(data: {
    salleId: number;
    niveauId: number;
    anneeScolaireId: number;
    matiereId?: number;
    enseignantId?: number;
    jourSemaine: number; // 1=lundi ... 5=vendredi
    heureDebut: string;
    heureFin: string;
    titre?: string;
  }) {
    if (await this.verifierConflitHoraire(data)) {
      throw new BadRequestException('Conflit détecté : ce créneau chevauche un créneau existant');
    }
    return this.prisma.emploiDuTemps.create({ data });
  }

  private async verifierConflitHoraire(data: {
    salleId: number;
    niveauId: number;
    jourSemaine: number;
    heureDebut: string;
    heureFin: string;
  }): Promise<boolean> {
    const conflits = await this.prisma.emploiDuTemps.findMany({
      where: {
        salleId: data.salleId,
        niveauId: data.niveauId,
        jourSemaine: data.jourSemaine,
      },
    });
    return conflits.some((c) => c.heureDebut < data.heureFin && data.heureDebut < c.heureFin);
  }

  listerEmploiDuTemps(salleId: number, niveauId: number) {
    return this.prisma.emploiDuTemps.findMany({
      where: { salleId, niveauId },
      include: { matiere: true, enseignant: true },
    });
  }

  // --- Absences ---
  // Tracées : on sait qui a saisi l'absence (saisiParId -> Utilisateur), conformément
  // à la checklist sécurité (traçabilité des actions sensibles).

  async saisirAbsence(data: { inscriptionId: number; date: Date; saisiParId: number }) {
    const inscription = await this.prisma.inscription.findUnique({ where: { id: data.inscriptionId } });
    if (!inscription) {
      throw new NotFoundException(`Inscription #${data.inscriptionId} introuvable`);
    }
    return this.prisma.absence.create({ data: { ...data, justifiee: false } });
  }

  justifierAbsence(absenceId: number, motif: string) {
    return this.prisma.absence.update({ where: { id: absenceId }, data: { justifiee: true, motif } });
  }

  // --- Dossiers partagés ---

  partagerDossier(data: { titre: string; fichierUrl: string; type?: string }) {
    return this.prisma.dossierPartage.create({ data });
  }

  listerDossiers() {
    return this.prisma.dossierPartage.findMany({ orderBy: { dateDepot: 'desc' } });
  }

  // --- Menu ---

  creerPeriodeMenu(data: { nom: string; dateDebut: Date; dateFin: Date }) {
    return this.prisma.periodeMenu.create({ data });
  }

  ajouterJourMenu(data: {
    periodeMenuId: number;
    date: Date;
    entree?: string;
    platPrincipal?: string;
    dessert?: string;
  }) {
    return this.prisma.jourMenu.create({ data });
  }

  // --- Inventaire ---

  listerInventaire(type?: TypeInventaire) {
    return this.prisma.inventaire.findMany({ where: type ? { type } : undefined });
  }
    creerInventaire(dto: { libelle: string; type: TypeInventaire; quantite: number }) {
  return this.prisma.inventaire.create({ data: dto });
}
  ajouterStock(inventaireId: number, quantite: number, utilisateurId: number, motif?: string) {
  return this.prisma.$transaction([
    this.prisma.inventaire.update({
      where: { id: inventaireId },
      data: { quantite: { increment: quantite } },
    }),
    this.prisma.mouvementInventaire.create({
      data: { inventaireId, quantite, utilisateurId, motif, type: 'ENTREE' },
    }),
  ]);
}

  retirerStock(inventaireId: number, quantite: number, utilisateurId: number, motif?: string) {
  return this.prisma.$transaction([
    this.prisma.inventaire.update({
      where: { id: inventaireId },
      data: { quantite: { decrement: quantite } },
    }),
    this.prisma.mouvementInventaire.create({
      data: { inventaireId, quantite, utilisateurId, motif, type: 'SORTIE' },
    }),
  ]);
}

  historiqueInventaire(inventaireId: number) {
  return this.prisma.mouvementInventaire.findMany({
    where: { inventaireId },
    include: { utilisateur: { select: { id: true, email: true, role: true } } },
    orderBy: { dateMouvement: 'desc' },
  });
}

  // --- Journal d'activité ---

  enregistrerAction(utilisateurId: number, action: string, details?: string) {
    return this.prisma.journalActivite.create({ data: { utilisateurId, action, details } });
  }

  // --- Publications (annonces) ---

  async publier(data: { titre: string; contenu: string; type: string; visiblePublic?: boolean }) {
  const publication = await this.prisma.publication.create({ data });

  if (!data.visiblePublic) {
    const personnel = await this.prisma.utilisateur.findMany({
      where: { role: { not: 'PARENT' } },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: personnel.map((p) => ({
        utilisateurId: p.id,
        message: `Nouvelle publication interne : ${data.titre}`,
      })),
    });
  }

  return publication;
}

  listerPublicationsPubliques() {
    return this.prisma.publication.findMany({
      where: { visiblePublic: true },
      orderBy: { datePublication: 'desc' },
    });
  }

  // --- Notifications ---

  listerNotifications(utilisateurId: number) {
    return this.prisma.notification.findMany({ where: { utilisateurId }, orderBy: { dateCreation: 'desc' } });
  }

  marquerCommeLu(notificationId: number) {
    return this.prisma.notification.update({ where: { id: notificationId }, data: { lu: true } });
  }

  // --- Rendez-vous ---
  // RendezVous est lié à un ParentEleve et à un Utilisateur (le compte de la personne
  // visée, pas directement Personnel) : on résout ici le Personnel -> Utilisateur.
  listerRendezVous(parentId?: number, personnelId?: number) {
  return this.prisma.rendezVous.findMany({
    where: {
      parentId,
      ...(personnelId && {
        utilisateur: { personnelId },
      }),
    },
    orderBy: { dateHeure: 'desc' },
    include: { parent: true, utilisateur: true },
  });
} 
  async demanderRendezVous(data: {
  parentId: number;
  personnelId: number;
  dateSouhaitee: Date;
  motif?: string;
}) {
  const personnel = await this.prisma.personnel.findUnique({
    where: { id: data.personnelId },
    include: { utilisateur: true },
  });
  if (!personnel?.utilisateur) {
    throw new NotFoundException('Ce membre du personnel n\'a pas de compte utilisateur lié');
  }
  const rdv = await this.prisma.rendezVous.create({
    data: {
      parentId: data.parentId,
      utilisateurId: personnel.utilisateur.id,
      dateHeure: data.dateSouhaitee,
      motif: data.motif,
      statut: StatutRendezVous.DEMANDE,
    },
  });
  await this.prisma.notification.create({
    data: {
      utilisateurId: personnel.utilisateur.id,
      message: `Nouvelle demande de rendez-vous pour le ${data.dateSouhaitee.toLocaleDateString('fr-FR')}`,
    },
  });
  return rdv;
}

  async confirmerRendezVous(id: number) {
  const rdv = await this.prisma.rendezVous.update({
    where: { id },
    data: { statut: StatutRendezVous.CONFIRME },
    include: { parent: { include: { utilisateur: true } } },
  });
  if (rdv.parent.utilisateur) {
    await this.prisma.notification.create({
      data: { utilisateurId: rdv.parent.utilisateur.id, message: 'Votre rendez-vous a été confirmé' },
    });
  }
  return rdv;
}

  async annulerRendezVous(id: number) {
  const rdv = await this.prisma.rendezVous.update({
    where: { id },
    data: { statut: StatutRendezVous.ANNULE },
    include: { parent: { include: { utilisateur: true } } },
  });
  if (rdv.parent.utilisateur) {
    await this.prisma.notification.create({
      data: { utilisateurId: rdv.parent.utilisateur.id, message: 'Votre rendez-vous a été annulé' },
    });
  }
  return rdv;
}
  // --- Remarques parents ---

 async envoyerRemarque(data: { parentId: number; utilisateurId: number; contenu: string }) {
  const remarque = await this.prisma.remarqueParent.create({
    data: { parentId: data.parentId, utilisateurId: data.utilisateurId, contenu: data.contenu },
  });
  const destinataires = await this.prisma.utilisateur.findMany({
    where: { role: { in: ['ADMIN', 'DIRECTRICE'] } },
    select: { id: true },
  });
  await this.prisma.notification.createMany({
    data: destinataires.map((d) => ({
      utilisateurId: d.id,
      message: 'Nouvelle remarque envoyée par un parent',
    })),
  });
  return remarque;
}

  marquerRemarqueTraitee(id: number) {
    return this.prisma.remarqueParent.update({ where: { id }, data: { traitee: true } });
  }



}


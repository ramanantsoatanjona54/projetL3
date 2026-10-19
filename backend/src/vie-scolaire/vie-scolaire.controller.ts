import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { VieScolaireService } from './vie-scolaire.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleUtilisateur, TypeInventaire } from '@prisma/client';
import { CreerCreneauEDTDto } from './dto/creer-creneau-edt.dto';
import { SaisirAbsenceDto } from './dto/saisir-absence.dto';
import {CreateInventaireDto} from './dto/create-inventaire.dto';

@Controller('vie-scolaire')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VieScolaireController {
  constructor(private readonly service: VieScolaireService) {}

  // --- Emploi du temps ---
@Post('emploi-du-temps')
@Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
creerCreneau(@Body() body: CreerCreneauEDTDto) {
  return this.service.creerCreneauEDT(body);
}

  @Get('emploi-du-temps')
  listerEDT(@Query('salleId', ParseIntPipe) salleId: number, @Query('niveauId', ParseIntPipe) niveauId: number) {
    return this.service.listerEmploiDuTemps(salleId, niveauId);
  }

  // --- Absences ---
@Post('absences')
@Roles(RoleUtilisateur.ENSEIGNANT, RoleUtilisateur.ADMIN)
saisirAbsence(@Req() req: any, @Body() body: SaisirAbsenceDto) {
  return this.service.saisirAbsence({
    inscriptionId: body.inscriptionId,
    date: new Date(body.date),
    saisiParId: req.user.id,
  });
}

  @Patch('absences/:id/justifier')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.SECRETARIAT)
  justifierAbsence(@Param('id', ParseIntPipe) id: number, @Body() body: { motif: string }) {
    return this.service.justifierAbsence(id, body.motif);
  }

  // --- Dossiers partagés ---
  @Post('dossiers')
  @Roles(RoleUtilisateur.ENSEIGNANT, RoleUtilisateur.ADMIN)
  partagerDossier(@Body() body: { titre: string; fichierUrl: string; type?: string }) {
    return this.service.partagerDossier(body);
  }

  @Get('dossiers')
  listerDossiers() {
    return this.service.listerDossiers();
  }

  // --- Menu ---
  @Post('menu/periodes')
  @Roles(RoleUtilisateur.ADMIN)
  creerPeriodeMenu(@Body() body: { nom: string; dateDebut: string; dateFin: string }) {
    return this.service.creerPeriodeMenu({
      nom: body.nom,
      dateDebut: new Date(body.dateDebut),
      dateFin: new Date(body.dateFin),
    });
  }

  @Post('menu/jours')
  @Roles(RoleUtilisateur.ADMIN)
  ajouterJourMenu(
    @Body() body: { periodeMenuId: number; date: string; entree?: string; platPrincipal?: string; dessert?: string },
  ) {
    return this.service.ajouterJourMenu({ ...body, date: new Date(body.date) });
  }

  // --- Inventaire ---
  @Patch('inventaire/:id/ajouter')
@Roles(RoleUtilisateur.COMPTABLE, RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN)
ajouterStock(@Param('id', ParseIntPipe) id: number, @Body() body: { quantite: number; motif?: string }, @Req() req: any) {
  return this.service.ajouterStock(id, body.quantite, req.user.id, body.motif);
}

  @Patch('inventaire/:id/retirer')
@Roles(RoleUtilisateur.COMPTABLE, RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN)
retirerStock(@Param('id', ParseIntPipe) id: number, @Body() body: { quantite: number; motif?: string }, @Req() req: any) {
  return this.service.retirerStock(id, body.quantite, req.user.id, body.motif);
}
  @Get('inventaire/:id/historique')
getHistoriqueInventaire(@Param('id', ParseIntPipe) id: number) {
  return this.service.historiqueInventaire(id);
}

  @Get('inventaire')
  listerInventaire(@Query('type') type?: TypeInventaire) {
    return this.service.listerInventaire(type);
  }
    @Post('inventaire')
  @Roles(RoleUtilisateur.COMPTABLE, RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN)
  creerInventaire(@Body() dto: CreateInventaireDto) {
  return this.service.creerInventaire(dto);
}
  

  // --- Publications (annonces) ---
  @Post('publications')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
  publier(@Body() body: { titre: string; contenu: string; type: string; visiblePublic?: boolean }) {
    return this.service.publier(body);
  }

  @Get('publications/publiques')
  listerPublicationsPubliques() {
    return this.service.listerPublicationsPubliques();
  }

  // --- Notifications ---
  @Get('notifications/:utilisateurId')
  listerNotifications(@Param('utilisateurId', ParseIntPipe) utilisateurId: number) {
    return this.service.listerNotifications(utilisateurId);
  }

  @Patch('notifications/:id/lu')
  marquerLu(@Param('id', ParseIntPipe) id: number) {
    return this.service.marquerCommeLu(id);
  }

  // --- Rendez-vous ---
  @Get('rendez-vous')
  listerRendezVous(
  @Query('parentId') parentId?: string,
  @Query('personnelId') personnelId?: string,
) {
  return this.service.listerRendezVous(
    parentId ? Number(parentId) : undefined,
    personnelId ? Number(personnelId) : undefined,
  );
}

  @Post('rendez-vous')
  @Roles(RoleUtilisateur.PARENT)
  demanderRendezVous(@Body() body: { parentId: number; personnelId: number; dateSouhaitee: string; motif?: string }) {
    return this.service.demanderRendezVous({ ...body, dateSouhaitee: new Date(body.dateSouhaitee) });
  }

  @Patch('rendez-vous/:id/confirmer')
  @Roles(RoleUtilisateur.ENSEIGNANT, RoleUtilisateur.DIRECTRICE)
  confirmerRendezVous(@Param('id', ParseIntPipe) id: number) {
    return this.service.confirmerRendezVous(id);
  }

  @Patch('rendez-vous/:id/annuler')
  annulerRendezVous(@Param('id', ParseIntPipe) id: number) {
    return this.service.annulerRendezVous(id);
  }

  // --- Remarques parents ---
  @Post('remarques')
  @Roles(RoleUtilisateur.PARENT)
  envoyerRemarque(@Req() req: any, @Body() body: { parentId: number; contenu: string }) {
    return this.service.envoyerRemarque({ parentId: body.parentId, utilisateurId: req.user.id, contenu: body.contenu });
  }

  @Patch('remarques/:id/traitee')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
  marquerRemarqueTraitee(@Param('id', ParseIntPipe) id: number) {
    return this.service.marquerRemarqueTraitee(id);
  }





}


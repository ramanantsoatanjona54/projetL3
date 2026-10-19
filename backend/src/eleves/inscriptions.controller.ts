import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { InscriptionsService } from './inscriptions.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleUtilisateur } from '@prisma/client';


@Controller('inscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InscriptionsController {
  constructor(private readonly inscriptionsService: InscriptionsService) {}

  @Get('en-attente')
  @Roles(RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
  listerEnAttente() {
    return this.inscriptionsService.listerEnAttente();
  }

  // Aperçu (rang de fratrie) affiché avant de créer l'inscription
  @Get('apercu')
  @Roles(RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN)
  apercu(
    @Query('eleveId', ParseIntPipe) eleveId: number,
    @Query('anneeScolaireId', ParseIntPipe) anneeScolaireId: number,
  ) {
    return this.inscriptionsService.apercu(eleveId, anneeScolaireId);
  }

  @Post()
  @Roles(RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN)
  creer(@Body() dto: CreateInscriptionDto, @Req() req: any) {
    return this.inscriptionsService.creerInscription(dto, req.user?.id);
  }

  // Seul le Secrétariat valide (après remise du dossier papier), pas la Directrice.
  @Patch(':id/valider')
  @Roles(RoleUtilisateur.SECRETARIAT)
  valider(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.inscriptionsService.valider(id, req.user?.id);
  }

  @Patch(':id/annuler')
  @Roles(RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN)
  annuler(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.inscriptionsService.annuler(id, req.user?.id);
  }

  // La fiche contient les coordonnées des parents : réservée au personnel
  @Get(':id/fiche')
  @Roles(RoleUtilisateur.SECRETARIAT, RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
  genererFiche(@Param('id', ParseIntPipe) id: number) {
    return this.inscriptionsService.genererFicheInscription(id);
  }
 
}
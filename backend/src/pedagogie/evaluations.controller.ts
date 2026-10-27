import { Body, Controller, Get, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SaisirEvaluationsDto, SuiviDto } from './dto/evaluations.dto';
import { EvaluationsService } from './evaluations.service';

const { ADMIN, DIRECTRICE, ENSEIGNANT } = RoleUtilisateur;

@Controller('pedagogie')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ENSEIGNANT,DIRECTRICE) // lecture ; l'enseignant est limité à sa salle par le service
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  // L'identité vient toujours du jeton
  private acteur(req: any) { return { id: req.user.id as number, role: req.user.role as RoleUtilisateur }; }

  @Get('salles')
  salles(@Req() req: any) { return this.service.salles(this.acteur(req)); }

  @Get('ceintures')
  ceintures(
    @Query('salleId', ParseIntPipe) salleId: number,
    @Query('niveauId', ParseIntPipe) niveauId: number,
    @Req() req: any,
  ) { return this.service.ceintures(this.acteur(req), salleId, niveauId); }

  @Get('elements')
  elements(
    @Query('salleId', ParseIntPipe) salleId: number,
    @Query('niveauId', ParseIntPipe) niveauId: number,
    @Query('ceintureId', ParseIntPipe) ceintureId: number,
    @Req() req: any,
  ) { return this.service.elements(this.acteur(req), salleId, niveauId, ceintureId); }

  @Get('evaluations')
  eleves(
    @Query('salleId', ParseIntPipe) salleId: number,
    @Query('niveauId', ParseIntPipe) niveauId: number,
    @Query('elementId', ParseIntPipe) elementId: number,
    @Req() req: any,
  ) { return this.service.eleves(this.acteur(req), salleId, niveauId, elementId); }

  @Post('evaluations')
  @Roles(ENSEIGNANT)
  enregistrer(@Body() dto: SaisirEvaluationsDto, @Req() req: any) { return this.service.enregistrer(this.acteur(req), dto); }

  @Post('suivi')
  @Roles(ENSEIGNANT)
  suivi(@Body() dto: SuiviDto, @Req() req: any) { return this.service.suivi(this.acteur(req), dto); }
}
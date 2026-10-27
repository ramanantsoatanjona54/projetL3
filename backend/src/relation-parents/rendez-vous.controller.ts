import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RaisonDto } from './dto/relation-parents.dto';
import { RendezVousService } from './rendez-vous.service';
import type { FiltresRdv } from './rendez-vous.service';
import { Audit } from '../audit/audit.decorator';
const { ADMIN, DIRECTRICE, SECRETARIAT, ENSEIGNANT } = RoleUtilisateur;

@Controller('rendez-vous')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles( DIRECTRICE, SECRETARIAT)
export class RendezVousController {
  constructor(private readonly service: RendezVousService) {}

  private acteur(req: any) { return { id: req.user.id as number, role: req.user.role as RoleUtilisateur }; }

  @Get()
  lister(@Query() q: FiltresRdv, @Req() req: any) { return this.service.lister(this.acteur(req), q); }

  @Patch(':id/confirmer')
  @Audit('RENDEZ_VOUS_CONFIRME', 'RendezVous')
  confirmer(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.confirmer(id, this.acteur(req)); }

  @Patch(':id/annuler')
  @Audit('RENDEZ_VOUS_ANNULE', 'RendezVous')
  annuler(@Param('id', ParseIntPipe) id: number, @Body() dto: RaisonDto, @Req() req: any) {
    return this.service.annuler(id, this.acteur(req), dto);
  }

  @Patch(':id/terminer')
  @Audit('RENDEZ_VOUS_TERMINE', 'RendezVous')
  terminer(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.terminer(id, this.acteur(req)); }
}
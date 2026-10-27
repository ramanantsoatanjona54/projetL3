import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DemanderRendezVousDto, EnvoyerRemarqueDto } from './dto/relation-parents.dto';
import { RendezVousService } from './rendez-vous.service';
import { RemarquesService } from './remarques.service';

// Espace parent : l'identité vient du jeton, aucun identifiant de parent n'est accepté depuis l'écran
@Controller('parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.PARENT)
export class ParentRelationController {
  constructor(private readonly rdv: RendezVousService, private readonly remarques: RemarquesService) {}

  @Get('rendez-vous/options')
  options(@Req() req: any) { return this.rdv.options(req.user.id); }

  @Get('rendez-vous')
  mesRendezVous(@Req() req: any) { return this.rdv.mesRendezVous(req.user.id); }

  @Post('rendez-vous')
  demander(@Body() dto: DemanderRendezVousDto, @Req() req: any) { return this.rdv.demander(req.user.id, dto); }

  @Patch('rendez-vous/:id/annuler')
  annuler(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.rdv.annulerParParent(id, req.user.id); }

  @Get('remarques')
  mesRemarques(@Req() req: any) { return this.remarques.mesRemarques(req.user.id); }

  @Post('remarques')
  envoyer(@Body() dto: EnvoyerRemarqueDto, @Req() req: any) { return this.remarques.envoyer(req.user.id, dto); }
}
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AbsencesService } from './absences.service';
import type { FiltresAbsences } from './absences.service';
import { JustifierAbsenceDto, SaisirAppelDto } from './dto/absences.dto';

const { ADMIN, SECRETARIAT, ENSEIGNANT, DIRECTRICE } = RoleUtilisateur;

@Controller('absences')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbsencesController {
  constructor(private readonly service: AbsencesService) {}

  // L'acteur vient toujours du jeton, jamais du corps de la requête
  private acteur(req: any) {
    return { id: req.user.id as number, role: req.user.role as RoleUtilisateur };
  }

  @Get('salles')
  @Roles(ENSEIGNANT, ADMIN, SECRETARIAT, DIRECTRICE)
  salles(@Req() req: any) {
    return this.service.salles(this.acteur(req));
  }

  @Get('appel')
  @Roles(ENSEIGNANT, ADMIN, SECRETARIAT, DIRECTRICE)
  appel(@Query('salleId', ParseIntPipe) salleId: number, @Query('date') date: string, @Req() req: any) {
    return this.service.appel(salleId, date, this.acteur(req));
  }

  @Post('appel')
  @Roles(ENSEIGNANT, ADMIN, SECRETARIAT)
  enregistrerAppel(@Body() dto: SaisirAppelDto, @Req() req: any) {
    return this.service.enregistrerAppel(dto, this.acteur(req));
  }

  @Get()
  @Roles(ENSEIGNANT, ADMIN, SECRETARIAT, DIRECTRICE)
  lister(@Query() q: FiltresAbsences, @Req() req: any) {
    return this.service.lister(q, this.acteur(req));
  }

  @Patch(':id/justifier')
  @Roles(ADMIN, SECRETARIAT)
  justifier(@Param('id', ParseIntPipe) id: number, @Body() dto: JustifierAbsenceDto, @Req() req: any) {
    return this.service.justifier(id, dto, this.acteur(req));
  }

  @Patch(':id/annuler-justification')
  @Roles(ADMIN, SECRETARIAT)
  annulerJustification(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.annulerJustification(id, this.acteur(req));
  }
}
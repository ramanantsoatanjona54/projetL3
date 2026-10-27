import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreerExamenDto, ModifierExamenDto, SaisirNotesExamenDto } from './dto/examens.dto';
import { ExamensService } from './examens.service';

const { ADMIN, DIRECTRICE, ENSEIGNANT } = RoleUtilisateur;

@Controller('examens-blancs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN, DIRECTRICE, ENSEIGNANT)
export class ExamensController {
  constructor(private readonly service: ExamensService) {}

  private acteur(req: any) { return { id: req.user.id as number, role: req.user.role as RoleUtilisateur }; }

  @Get() lister() { return this.service.lister(); }
  @Get('matieres') matieres() { return this.service.matieres(); }
  @Get('salles') salles(@Req() req: any) { return this.service.salles(this.acteur(req)); }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @Query('salleId', ParseIntPipe) salleId: number, @Req() req: any) {
    return this.service.detail(this.acteur(req), id, salleId);
  }

  @Post() @Roles(ADMIN)
  creer(@Body() dto: CreerExamenDto, @Req() req: any) { return this.service.creer(this.acteur(req), dto); }

  @Patch(':id') @Roles(ADMIN)
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: ModifierExamenDto, @Req() req: any) {
    return this.service.modifier(this.acteur(req), id, dto);
  }

  @Delete(':id') @Roles(ADMIN)
  supprimer(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.supprimer(this.acteur(req), id); }

  @Post(':id/notes') @Roles(ENSEIGNANT)
  notes(@Param('id', ParseIntPipe) id: number, @Body() dto: SaisirNotesExamenDto, @Req() req: any) {
    return this.service.enregistrerNotes(this.acteur(req), id, dto);
  }
}
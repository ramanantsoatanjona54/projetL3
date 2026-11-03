import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AppreciationDto, PublicationClasseDto, PublicationDto, SaisirBulletinDto } from './dto/bulletins.dto';
import { BulletinsService } from './bulletins.service';

const { ADMIN, DIRECTRICE, ENSEIGNANT, PARENT } = RoleUtilisateur;

@Controller('bulletins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ENSEIGNANT, ADMIN, DIRECTRICE)
export class BulletinsController {
  constructor(private readonly service: BulletinsService) {}

  private acteur(req: any) { return { id: req.user.id as number, role: req.user.role as RoleUtilisateur }; }

  @Get('salles') salles(@Req() req: any) { return this.service.salles(this.acteur(req)); }

  @Get('classe')
  classe(
    @Query('salleId', ParseIntPipe) salleId: number,
    @Query('niveauId', ParseIntPipe) niveauId: number,
    @Query('semestre', ParseIntPipe) semestre: number,
    @Query('anneeId') anneeId: string | undefined,
    @Req() req: any,
  ) {
    return this.service.classe(this.acteur(req), salleId, niveauId, semestre, anneeId ? Number(anneeId) : undefined);
  }

  @Post('classe/publication') @Roles(ADMIN, DIRECTRICE)
  publierClasse(@Body() dto: PublicationClasseDto, @Req() req: any) { return this.service.publierClasse(this.acteur(req), dto); }

  @Get('annees') @Roles(ADMIN, DIRECTRICE)
  annees() { return this.service.annees(); }

  @Get(':inscriptionId')
  voir(@Param('inscriptionId', ParseIntPipe) id: number, @Query('semestre', ParseIntPipe) semestre: number, @Req() req: any): Promise<unknown> {
    return this.service.voir(this.acteur(req), id, semestre);
  }

  // Saisie des évaluations du bulletin : l'enseignante de la salle uniquement
  // Document d'un examen blanc (7e)
  @Get(':inscriptionId/examen/:numero')
  examen(@Param('inscriptionId', ParseIntPipe) id: number, @Param('numero', ParseIntPipe) numero: number, @Req() req: any): Promise<unknown> {
    return this.service.voirExamen(this.acteur(req), id, numero);
  }

  @Patch(':inscriptionId/evaluations') @Roles(ENSEIGNANT)
  saisir(@Param('inscriptionId', ParseIntPipe) id: number, @Body() dto: SaisirBulletinDto, @Req() req: any) {
    return this.service.saisir(this.acteur(req), id, dto);
  }

  @Patch(':inscriptionId/appreciation') @Roles(ENSEIGNANT, ADMIN, DIRECTRICE)
  appreciation(@Param('inscriptionId', ParseIntPipe) id: number, @Body() dto: AppreciationDto, @Req() req: any) {
    return this.service.appreciation(this.acteur(req), id, dto);
  }

  @Post(':inscriptionId/publication') @Roles(ADMIN, DIRECTRICE)
  publier(@Param('inscriptionId', ParseIntPipe) id: number, @Body() dto: PublicationDto, @Req() req: any) {
    return this.service.publier(this.acteur(req), id, dto);
  }
}

@Controller('parent/inscriptions/:inscriptionId/bulletins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PARENT)
export class ParentBulletinsController {
  constructor(private readonly service: BulletinsService) {}

  @Get()
  liste(@Param('inscriptionId', ParseIntPipe) id: number, @Req() req: any) { return this.service.semestresParent(req.user.id, id); }

  @Get('historique')
  historique(@Param('inscriptionId', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.historiqueParent(req.user.id, id);
  }

  @Get('progression/:semestre')
  progression(@Param('inscriptionId', ParseIntPipe) id: number, @Param('semestre', ParseIntPipe) semestre: number, @Req() req: any): Promise<unknown> {
    return this.service.progressionParent(req.user.id, id, semestre);
  }

  // Routes statiques avant « :semestre »
  @Get('examens')
  examens(@Param('inscriptionId', ParseIntPipe) id: number, @Req() req: any) { return this.service.examensParent(req.user.id, id); }

  @Get('examens/:numero')
  examen(@Param('inscriptionId', ParseIntPipe) id: number, @Param('numero', ParseIntPipe) numero: number, @Req() req: any): Promise<unknown> {
    return this.service.voirExamenParent(req.user.id, id, numero);
  }

  @Get(':semestre')
  voir(@Param('inscriptionId', ParseIntPipe) id: number, @Param('semestre', ParseIntPipe) semestre: number, @Req() req: any): Promise<unknown> {
    return this.service.voirParent(req.user.id, id, semestre);
  }
}
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreerCreneauDto, ModifierCreneauDto } from './dto/edt.dto';
import { EmploiDuTempsService } from './emploi-du-temps.service';

const { ADMIN, DIRECTRICE, SECRETARIAT, ENSEIGNANT, COMPTABLE } = RoleUtilisateur;

@Controller('emploi-du-temps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN, DIRECTRICE, SECRETARIAT, ENSEIGNANT, COMPTABLE)
export class EmploiDuTempsController {
  constructor(private readonly service: EmploiDuTempsService) {}

  private acteur(req: any) { return { id: req.user.id as number }; }

  @Get('salles')
  salles() { return this.service.salles(); }

    @Get()
  pourSalleNiveau(
    @Query('salleId', ParseIntPipe) salleId: number,
    @Query('niveauId', ParseIntPipe) niveauId: number,
  ) { return this.service.pourSalleNiveau(salleId, niveauId); }
  
  @Post()
  @Roles(ADMIN, DIRECTRICE)
  creer(@Body() dto: CreerCreneauDto, @Req() req: any) { return this.service.creer(dto, this.acteur(req)); }

  @Patch(':id')
  @Roles(ADMIN, DIRECTRICE)
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: ModifierCreneauDto, @Req() req: any) {
    return this.service.modifier(id, dto, this.acteur(req));
  }

  @Delete(':id')
  @Roles(ADMIN, DIRECTRICE)
  supprimer(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.supprimer(id, this.acteur(req)); }
}
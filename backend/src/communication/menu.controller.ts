import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EnregistrerJourMenuDto, ModifierPeriodeMenuDto, PeriodeMenuDto } from './dto/communication.dto';
import { MenuService } from './menu.service';
import { TousRoles } from '../auth/decorators/roles.decorator';

const { ADMIN, DIRECTRICE, SECRETARIAT } = RoleUtilisateur;

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private readonly service: MenuService) {}

  private acteur(req: any) { return { id: req.user.id as number }; }

  // Lecture : tout utilisateur connecté (parents inclus)
  @Get('semaine')
  @TousRoles()
  semaine(@Query('date') date?: string) { return this.service.semaine(date); }

  @Get('periodes')
  @Roles(ADMIN, DIRECTRICE, SECRETARIAT)
  periodes() { return this.service.periodes(); }

  @Post('periodes')
  @Roles(ADMIN, SECRETARIAT)
  creerPeriode(@Body() dto: PeriodeMenuDto, @Req() req: any) { return this.service.creerPeriode(dto, this.acteur(req)); }

  @Patch('periodes/:id')
  @Roles(ADMIN,  SECRETARIAT)
  modifierPeriode(@Param('id', ParseIntPipe) id: number, @Body() dto: ModifierPeriodeMenuDto, @Req() req: any) {
    return this.service.modifierPeriode(id, dto, this.acteur(req));
  }

  @Delete('periodes/:id')
  @Roles(ADMIN, SECRETARIAT)
  supprimerPeriode(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.supprimerPeriode(id, this.acteur(req));
  }

  @Post('periodes/:id/jours')
  @Roles(ADMIN, SECRETARIAT)
  enregistrerJour(@Param('id', ParseIntPipe) id: number, @Body() dto: EnregistrerJourMenuDto, @Req() req: any) {
    return this.service.enregistrerJour(id, dto, this.acteur(req));
  }

  @Delete('periodes/:id/jours/:date')
  @Roles(ADMIN, SECRETARIAT)
  supprimerJour(@Param('id', ParseIntPipe) id: number, @Param('date') date: string, @Req() req: any) {
    return this.service.supprimerJour(id, date, this.acteur(req));
  }
}
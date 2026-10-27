import { Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RemarquesService } from './remarques.service';
import type { FiltresRemarques } from './remarques.service';

@Controller('remarques')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
export class RemarquesController {
  constructor(private readonly service: RemarquesService) {}

  private acteur(req: any) { return { id: req.user.id as number, role: req.user.role as RoleUtilisateur }; }

  @Get()
  lister(@Query() q: FiltresRemarques) { return this.service.lister(q); }

  @Patch(':id/traitee')
  traitee(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.changerEtat(id, true, this.acteur(req)); }

  @Patch(':id/rouvrir')
  rouvrir(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.changerEtat(id, false, this.acteur(req)); }
}
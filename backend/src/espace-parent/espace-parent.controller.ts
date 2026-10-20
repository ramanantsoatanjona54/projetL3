import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EspaceParentService } from './espace-parent.service';

@Controller('parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.PARENT) // tout cet espace est réservé aux comptes parents
export class EspaceParentController {
  constructor(private readonly service: EspaceParentService) {}

  @Get('enfants')
  enfants(@Req() req: any) {
    return this.service.enfants(req.user.id);
  }

  @Get('inscriptions/:inscriptionId/situation')
  situation(@Param('inscriptionId', ParseIntPipe) inscriptionId: number, @Req() req: any) {
    return this.service.situation(inscriptionId, req.user.id);
  }

  @Get('paiements/:id/recu')
  recu(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.recu(id, req.user.id);
  }
}
import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FinancesService } from '../finances/finances.service';
import { EmploiDuTempsService } from './emploi-du-temps.service';

@Controller('parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.PARENT)
export class ParentEdtController {
  constructor(private readonly service: EmploiDuTempsService, private readonly finances: FinancesService) {}

  @Get('inscriptions/:inscriptionId/emploi-du-temps')
  async emploiDuTemps(@Param('inscriptionId', ParseIntPipe) inscriptionId: number, @Req() req: any) {
    await this.finances.verifierAccesParent(inscriptionId, req.user.id); // 404 si ce n'est pas son enfant
    return this.service.pourInscription(inscriptionId);
  }
}
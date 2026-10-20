import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FinancesService } from '../finances/finances.service';
import { AbsencesService } from './absences.service';

@Controller('parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.PARENT)
export class ParentAbsencesController {
  constructor(
    private readonly service: AbsencesService,
    private readonly finances: FinancesService,
  ) {}

  @Get('inscriptions/:inscriptionId/absences')
  async absences(@Param('inscriptionId', ParseIntPipe) inscriptionId: number, @Req() req: any) {
    // 404 si l'inscription n'appartient pas à un enfant de ce parent
    await this.finances.verifierAccesParent(inscriptionId, req.user.id);
    return this.service.absencesPourParent(inscriptionId);
  }
}
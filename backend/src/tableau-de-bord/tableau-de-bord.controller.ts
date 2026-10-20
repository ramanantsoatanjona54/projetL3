import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TableauDeBordService } from './tableau-de-bord.service';

@Controller('tableau-de-bord')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTRICE,
  RoleUtilisateur.SECRETARIAT,
  RoleUtilisateur.COMPTABLE,
  RoleUtilisateur.ENSEIGNANT,
)
export class TableauDeBordController {
  constructor(private readonly service: TableauDeBordService) {}

  @Get()
  tableau(@Req() req: any) {
    return this.service.pour(req.user.role);
  }
}
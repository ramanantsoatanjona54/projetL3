import { Body, Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AffectationsService } from './affectations.service';
import { AffecterEnseignantDto } from './dto/affecter-enseignant.dto';

@Controller('affectations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AffectationsController {
  constructor(private readonly service: AffectationsService) {}

  @Get('salles')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE, RoleUtilisateur.SECRETARIAT)
  salles(): Promise<unknown> { return this.service.salles(); }

  @Get('enseignants')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE, RoleUtilisateur.SECRETARIAT)
  enseignants(): Promise<unknown> { return this.service.enseignants(); }

  @Patch('salles/:id/enseignant')
  @Roles(RoleUtilisateur.ADMIN)
  affecter(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: AffecterEnseignantDto) {
    return this.service.affecter(req.user.id, id, dto);
  }
}
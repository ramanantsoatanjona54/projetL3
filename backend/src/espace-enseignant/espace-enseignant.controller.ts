import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EspaceEnseignantService } from './espace-enseignant.service';

@Controller('enseignant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ENSEIGNANT)
export class EspaceEnseignantController {
  constructor(private readonly service: EspaceEnseignantService) {}

  @Get('accueil')
  accueil(@Req() req: any): Promise<unknown> { return this.service.accueil(req.user.id); }

  @Get('eleves')
  eleves(@Req() req: any): Promise<unknown> { return this.service.eleves(req.user.id); }
  
  @Get('profil')
  profil(@Req() req: any): Promise<unknown> { return this.service.profil(req.user.id); }
}
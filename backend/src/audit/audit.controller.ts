import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';
import type { FiltresAudit } from './audit.service';

// Lecture seule : aucune route ne permet de modifier ou supprimer une trace
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get('filtres')
  filtres() {
    return this.service.filtres();
  }

  @Get()
  lister(@Query() q: FiltresAudit) {
    return this.service.lister(q);
  }
}
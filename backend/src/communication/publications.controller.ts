import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreerPublicationDto, ModifierPublicationDto } from './dto/communication.dto';
import { PublicationsService } from './publications.service';
import type { FiltresPublications } from './publications.service';
import { TousRoles } from '../auth/decorators/roles.decorator';

const { ADMIN, DIRECTRICE } = RoleUtilisateur;

@Controller('publications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PublicationsController {
  constructor(private readonly service: PublicationsService) {}

  private acteur(req: any) { return { id: req.user.id as number, role: req.user.role as RoleUtilisateur }; }

  // Tout utilisateur connecté ; le service filtre selon le rôle (parent : publiques seulement)
  @Get()
  @TousRoles()
  lister(@Query() q: FiltresPublications, @Req() req: any) { return this.service.lister(this.acteur(req), q); }

  @Post()
  @Roles(ADMIN, DIRECTRICE)
  creer(@Body() dto: CreerPublicationDto, @Req() req: any) { return this.service.creer(dto, this.acteur(req)); }

  @Patch(':id')
  @Roles(ADMIN, DIRECTRICE)
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: ModifierPublicationDto, @Req() req: any) {
    return this.service.modifier(id, dto, this.acteur(req));
  }

  @Delete(':id')
  @Roles(ADMIN, DIRECTRICE)
  supprimer(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.supprimer(id, this.acteur(req)); }
}
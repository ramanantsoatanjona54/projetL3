import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UtilisateursService } from './utilisateurs.service';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';

@Controller('utilisateurs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN) // toute la gestion des comptes est réservée à l'administrateur
export class UtilisateursController {
  constructor(private readonly service: UtilisateursService) {}

  @Get() lister() { return this.service.lister(); }

  @Get('roles') roles() { return this.service.roles(); }

  @Get('personnel-disponible') personnelDisponible() { return this.service.personnelDisponible(); }

  @Post() creer(@Body() dto: CreateUtilisateurDto, @Req() req: any) {
    return this.service.creer(dto, req.user?.id);
  }

  @Patch(':id')
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUtilisateurDto, @Req() req: any) {
    return this.service.modifier(id, dto, req.user?.id);
  }

  @Post(':id/reinitialiser-mot-de-passe')
  reinitialiser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.reinitialiserMotDePasse(id, req.user?.id);
  }

  @Post(':id/deverrouiller')
  deverrouiller(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.deverrouiller(id, req.user?.id);
  }
}
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreerArticleDto, ModifierArticleDto, MouvementDto } from './dto/inventaire.dto';
import { InventaireService } from './inventaire.service';
import type { FiltresHistorique, FiltresInventaire } from './inventaire.service';

const { ADMIN, DIRECTRICE, SECRETARIAT, COMPTABLE } = RoleUtilisateur;

@Controller('inventaire')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(DIRECTRICE, SECRETARIAT, COMPTABLE) // lecture
export class InventaireController {
  constructor(private readonly service: InventaireService) {}

  private acteur(req: any) { return { id: req.user.id as number }; }

  @Get()
  lister(@Query() q: FiltresInventaire) { return this.service.lister(q); }

  @Post()
  @Roles( SECRETARIAT, COMPTABLE)
  creer(@Body() dto: CreerArticleDto, @Req() req: any) { return this.service.creer(dto, this.acteur(req)); }

  @Patch(':id')
  @Roles( SECRETARIAT, COMPTABLE)
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: ModifierArticleDto, @Req() req: any) {
    return this.service.modifier(id, dto, this.acteur(req));
  }

  @Post(':id/entree')
  @Roles( SECRETARIAT, COMPTABLE)
  entree(@Param('id', ParseIntPipe) id: number, @Body() dto: MouvementDto, @Req() req: any) {
    return this.service.mouvement(id, 'ENTREE', dto, this.acteur(req));
  }

  @Post(':id/sortie')
  @Roles( SECRETARIAT, COMPTABLE)
  sortie(@Param('id', ParseIntPipe) id: number, @Body() dto: MouvementDto, @Req() req: any) {
    return this.service.mouvement(id, 'SORTIE', dto, this.acteur(req));
  }

  @Get(':id/historique')
  historique(@Param('id', ParseIntPipe) id: number, @Query() q: FiltresHistorique) { return this.service.historique(id, q); }

  @Delete(':id')
  @Roles(ADMIN)
  supprimer(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.supprimer(id, this.acteur(req)); }
}
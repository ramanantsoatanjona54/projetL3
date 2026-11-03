import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BulletinModelesService } from './bulletin-modeles.service';
import {
  CopierModeleDto, CreerElementDto, DeplacerElementDto, ModifierElementDto, OrdreElementDto,
} from './dto/bulletin-modeles.dto';

// Lecture : administration et direction. Toute modification : ADMIN uniquement.
const LECTURE = [RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE];
const ECRITURE = [RoleUtilisateur.ADMIN];

@Controller('bulletin-modeles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulletinModelesController {
  constructor(private readonly service: BulletinModelesService) {}

  @Get('semestres') @Roles(...LECTURE)
  semestres(): Promise<unknown> { return this.service.semestres(); }

  @Get('niveaux/:niveauId') @Roles(...LECTURE)
  arbre(@Param('niveauId', ParseIntPipe) niveauId: number): Promise<unknown> { return this.service.arbre(niveauId); }

  @Post('semestres/:id/copier') @Roles(...ECRITURE) @Audit('MODELE_BULLETIN_COPIE', 'Semestre')
  copier(@Param('id', ParseIntPipe) id: number, @Body() dto: CopierModeleDto): Promise<unknown> { return this.service.copier(id, dto); }

  @Post('elements') @Roles(...ECRITURE) @Audit('ELEMENT_BULLETIN_CREE', 'ElementBulletin')
  creer(@Body() dto: CreerElementDto): Promise<unknown> { return this.service.creer(dto); }

  @Patch('elements/:id') @Roles(...ECRITURE) @Audit('ELEMENT_BULLETIN_MODIFIE', 'ElementBulletin')
  modifier(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: ModifierElementDto): Promise<unknown> {
    return this.service.modifier(req.user.id, id, dto);
  }

  @Delete('elements/:id') @Roles(...ECRITURE) @Audit('ELEMENT_BULLETIN_SUPPRIME', 'ElementBulletin')
  supprimer(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimer(id); }

  @Post('elements/:id/archiver') @Roles(...ECRITURE) @Audit('ELEMENT_BULLETIN_ARCHIVE', 'ElementBulletin')
  archiver(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.archiver(id); }

  @Post('elements/:id/restaurer') @Roles(...ECRITURE) @Audit('ELEMENT_BULLETIN_RESTAURE', 'ElementBulletin')
  restaurer(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.restaurer(id); }

  @Post('elements/:id/deplacer') @Roles(...ECRITURE) @Audit('ELEMENT_BULLETIN_DEPLACE', 'ElementBulletin')
  deplacer(@Param('id', ParseIntPipe) id: number, @Body() dto: DeplacerElementDto): Promise<unknown> { return this.service.deplacer(id, dto); }

  @Post('elements/:id/ordre') @Roles(...ECRITURE)
  ordre(@Param('id', ParseIntPipe) id: number, @Body() dto: OrdreElementDto): Promise<unknown> { return this.service.changerOrdre(id, dto); }
}
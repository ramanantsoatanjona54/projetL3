import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreerCompetenceDto, CreerDomaineDto, CreerLeconDto, CreerRubriqueDto, CreerSousDomaineDto,
  LibelleDto, ModifierLeconDto, NomDto,
} from './dto/programmes.dto';
import { ProgrammesService } from './programmes.service';

@Controller('programmes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
export class ProgrammesController {
  constructor(private readonly service: ProgrammesService) {}

  // ----- Lecture -----
  @Get('niveaux') niveaux(): Promise<unknown> { return this.service.niveaux(); }
  @Get('matieres') matieres(): Promise<unknown> { return this.service.matieres(); }
  @Get('niveaux/:id/arbre') arbre(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.arbre(id); }

  // ----- Domaines -----
  @Post('domaines') @Audit('DOMAINE_CREE', 'Domaine')
  creerDomaine(@Body() dto: CreerDomaineDto): Promise<unknown> { return this.service.creerDomaine(dto); }

  @Patch('domaines/:id') @Audit('DOMAINE_MODIFIE', 'Domaine')
  modifierDomaine(@Param('id', ParseIntPipe) id: number, @Body() dto: NomDto): Promise<unknown> { return this.service.modifierDomaine(id, dto); }

  @Delete('domaines/:id') @Audit('DOMAINE_SUPPRIME', 'Domaine')
  supprimerDomaine(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerDomaine(id); }

  // ----- Sous-domaines -----
  @Post('sous-domaines') @Audit('SOUS_DOMAINE_CREE', 'SousDomaine')
  creerSousDomaine(@Body() dto: CreerSousDomaineDto): Promise<unknown> { return this.service.creerSousDomaine(dto); }

  @Patch('sous-domaines/:id') @Audit('SOUS_DOMAINE_MODIFIE', 'SousDomaine')
  modifierSousDomaine(@Param('id', ParseIntPipe) id: number, @Body() dto: NomDto): Promise<unknown> { return this.service.modifierSousDomaine(id, dto); }

  @Delete('sous-domaines/:id') @Audit('SOUS_DOMAINE_SUPPRIME', 'SousDomaine')
  supprimerSousDomaine(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerSousDomaine(id); }

  // ----- Compétences -----
  @Post('competences') @Audit('COMPETENCE_CREEE', 'Competence')
  creerCompetence(@Body() dto: CreerCompetenceDto): Promise<unknown> { return this.service.creerCompetence(dto); }

  @Patch('competences/:id') @Audit('COMPETENCE_MODIFIEE', 'Competence')
  modifierCompetence(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: LibelleDto): Promise<unknown> {
    return this.service.modifierCompetence(req.user.id, id, dto);
  }

  @Delete('competences/:id') @Audit('COMPETENCE_SUPPRIMEE', 'Competence')
  supprimerCompetence(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerCompetence(id); }

  // ----- Rubriques -----
  @Post('rubriques') @Audit('RUBRIQUE_CREEE', 'Rubrique')
  creerRubrique(@Body() dto: CreerRubriqueDto): Promise<unknown> { return this.service.creerRubrique(dto); }

  @Patch('rubriques/:id') @Audit('RUBRIQUE_MODIFIEE', 'Rubrique')
  modifierRubrique(@Param('id', ParseIntPipe) id: number, @Body() dto: NomDto): Promise<unknown> { return this.service.modifierRubrique(id, dto); }

  @Delete('rubriques/:id') @Audit('RUBRIQUE_SUPPRIMEE', 'Rubrique')
  supprimerRubrique(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerRubrique(id); }

  // ----- Leçons -----
  @Post('lecons') @Audit('LECON_CREEE', 'Lecon')
  creerLecon(@Body() dto: CreerLeconDto): Promise<unknown> { return this.service.creerLecon(dto); }

  @Patch('lecons/:id') @Audit('LECON_MODIFIEE', 'Lecon')
  modifierLecon(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: ModifierLeconDto): Promise<unknown> {
    return this.service.modifierLecon(req.user.id, id, dto);
  }

  @Delete('lecons/:id') @Audit('LECON_SUPPRIMEE', 'Lecon')
  supprimerLecon(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerLecon(id); }
}
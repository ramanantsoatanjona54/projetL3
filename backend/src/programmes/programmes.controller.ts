import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreerCeintureDto, CreerCompetenceDto, CreerDomaineDto, CreerLeconDto, CreerRubriqueDto, CreerSemestreDto,
  CreerSousDomaineDto, DeplacerCeintureDto, DeplacerContenuDto, DeplacerDomainesDto, DeplacerLeconsDto,
  LibelleDto, ModifierCeintureDto, ModifierLeconDto, NomDto,
} from './dto/programmes.dto';
import { ProgrammesService } from './programmes.service';

// Lecture : administration et direction. Toute modification : ADMIN uniquement.
const LECTURE = [RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE];
const ECRITURE = [RoleUtilisateur.ADMIN];

@Controller('programmes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgrammesController {
  constructor(private readonly service: ProgrammesService) {}

  // ----- Lecture -----
  @Get('niveaux') @Roles(...LECTURE)
  niveaux(): Promise<unknown> { return this.service.niveaux(); }

  @Get('matieres') @Roles(...LECTURE)
  matieres(): Promise<unknown> { return this.service.matieres(); }

  @Get('niveaux/:id/arbre') @Roles(...LECTURE)
  arbre(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.arbre(id); }

  // ----- Semestres -----
  @Post('semestres') @Roles(...ECRITURE) @Audit('SEMESTRE_CREE', 'Semestre')
  creerSemestre(@Body() dto: CreerSemestreDto): Promise<unknown> { return this.service.creerSemestre(dto); }

  @Delete('semestres/:id') @Roles(...ECRITURE) @Audit('SEMESTRE_SUPPRIME', 'Semestre')
  supprimerSemestre(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerSemestre(id); }

  // ----- Ceintures (les routes fixes passent avant les routes en :id) -----
  @Post('ceintures') @Roles(...ECRITURE) @Audit('CEINTURE_CREEE', 'Ceinture')
  creerCeinture(@Body() dto: CreerCeintureDto): Promise<unknown> { return this.service.creerCeinture(dto); }

  @Patch('ceintures/:id') @Roles(...ECRITURE) @Audit('CEINTURE_MODIFIEE', 'Ceinture')
  modifierCeinture(@Param('id', ParseIntPipe) id: number, @Body() dto: ModifierCeintureDto): Promise<unknown> {
    return this.service.modifierCeinture(id, dto);
  }

  @Delete('ceintures/:id') @Roles(...ECRITURE) @Audit('CEINTURE_SUPPRIMEE', 'Ceinture')
  supprimerCeinture(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerCeinture(id); }

  @Post('ceintures/:id/deplacer') @Roles(...ECRITURE) @Audit('CEINTURE_DEPLACEE', 'Ceinture')
  deplacerCeinture(@Param('id', ParseIntPipe) id: number, @Body() dto: DeplacerCeintureDto): Promise<unknown> {
    return this.service.deplacerCeinture(id, dto);
  }

  @Post('ceintures/:id/deplacer-contenu') @Roles(...ECRITURE) @Audit('CONTENU_CEINTURE_DEPLACE', 'Ceinture')
  deplacerContenu(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: DeplacerContenuDto): Promise<unknown> {
    return this.service.deplacerContenuCeinture(req.user.id, id, dto);
  }

  // ----- Domaines -----
  @Post('domaines/deplacer') @Roles(...ECRITURE) @Audit('DOMAINES_DEPLACES', 'Domaine')
  deplacerDomaines(@Req() req: any, @Body() dto: DeplacerDomainesDto): Promise<unknown> {
    return this.service.deplacerDomaines(req.user.id, dto);
  }

  @Post('domaines') @Roles(...ECRITURE) @Audit('DOMAINE_CREE', 'Domaine')
  creerDomaine(@Body() dto: CreerDomaineDto): Promise<unknown> { return this.service.creerDomaine(dto); }

  @Patch('domaines/:id') @Roles(...ECRITURE) @Audit('DOMAINE_MODIFIE', 'Domaine')
  modifierDomaine(@Param('id', ParseIntPipe) id: number, @Body() dto: NomDto): Promise<unknown> { return this.service.modifierDomaine(id, dto); }

  @Delete('domaines/:id') @Roles(...ECRITURE) @Audit('DOMAINE_SUPPRIME', 'Domaine')
  supprimerDomaine(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerDomaine(id); }

  // ----- Sous-domaines -----
  @Post('sous-domaines') @Roles(...ECRITURE) @Audit('SOUS_DOMAINE_CREE', 'SousDomaine')
  creerSousDomaine(@Body() dto: CreerSousDomaineDto): Promise<unknown> { return this.service.creerSousDomaine(dto); }

  @Patch('sous-domaines/:id') @Roles(...ECRITURE) @Audit('SOUS_DOMAINE_MODIFIE', 'SousDomaine')
  modifierSousDomaine(@Param('id', ParseIntPipe) id: number, @Body() dto: NomDto): Promise<unknown> { return this.service.modifierSousDomaine(id, dto); }

  @Delete('sous-domaines/:id') @Roles(...ECRITURE) @Audit('SOUS_DOMAINE_SUPPRIME', 'SousDomaine')
  supprimerSousDomaine(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerSousDomaine(id); }

  // ----- Compétences -----
  @Post('competences') @Roles(...ECRITURE) @Audit('COMPETENCE_CREEE', 'Competence')
  creerCompetence(@Body() dto: CreerCompetenceDto): Promise<unknown> { return this.service.creerCompetence(dto); }

  @Patch('competences/:id') @Roles(...ECRITURE) @Audit('COMPETENCE_MODIFIEE', 'Competence')
  modifierCompetence(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: LibelleDto): Promise<unknown> {
    return this.service.modifierCompetence(req.user.id, id, dto);
  }

  @Delete('competences/:id') @Roles(...ECRITURE) @Audit('COMPETENCE_SUPPRIMEE', 'Competence')
  supprimerCompetence(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerCompetence(id); }

  // ----- Rubriques -----
  @Post('rubriques') @Roles(...ECRITURE) @Audit('RUBRIQUE_CREEE', 'Rubrique')
  creerRubrique(@Body() dto: CreerRubriqueDto): Promise<unknown> { return this.service.creerRubrique(dto); }

  @Patch('rubriques/:id') @Roles(...ECRITURE) @Audit('RUBRIQUE_MODIFIEE', 'Rubrique')
  modifierRubrique(@Param('id', ParseIntPipe) id: number, @Body() dto: NomDto): Promise<unknown> { return this.service.modifierRubrique(id, dto); }

  @Delete('rubriques/:id') @Roles(...ECRITURE) @Audit('RUBRIQUE_SUPPRIMEE', 'Rubrique')
  supprimerRubrique(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerRubrique(id); }

  // ----- Leçons -----
  @Post('lecons/deplacer') @Roles(...ECRITURE) @Audit('LECONS_DEPLACEES', 'Lecon')
  deplacerLecons(@Req() req: any, @Body() dto: DeplacerLeconsDto): Promise<unknown> {
    return this.service.deplacerLecons(req.user.id, dto);
  }

  @Post('lecons') @Roles(...ECRITURE) @Audit('LECON_CREEE', 'Lecon')
  creerLecon(@Body() dto: CreerLeconDto): Promise<unknown> { return this.service.creerLecon(dto); }

  @Patch('lecons/:id') @Roles(...ECRITURE) @Audit('LECON_MODIFIEE', 'Lecon')
  modifierLecon(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: ModifierLeconDto): Promise<unknown> {
    return this.service.modifierLecon(req.user.id, id, dto);
  }

  @Delete('lecons/:id') @Roles(...ECRITURE) @Audit('LECON_SUPPRIMEE', 'Lecon')
  supprimerLecon(@Param('id', ParseIntPipe) id: number): Promise<unknown> { return this.service.supprimerLecon(id); }
}
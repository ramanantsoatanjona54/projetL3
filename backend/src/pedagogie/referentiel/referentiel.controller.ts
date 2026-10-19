import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReferentielService } from './referentiel.service';
import { CreateDomaineDto } from './dto/create-domaine.dto';
import { CreateSousDomaineDto } from './dto/create-sous-domaine.dto';
import { CreateCompetenceDto } from './dto/create-competence.dto';
import { CreateLeconDto } from './dto/create-lecon.dto';
import { UpdateLeconDto } from './dto/update-lecon.dto';
import { CreateMatiereDto } from './dto/create-matiere.dto';
import { UpdateMatiereDto } from './dto/update-matiere.dto';
import { CreateRubriqueDto } from './dto/create-rubrique.dto';
import { UpdateRubriqueDto } from './dto/update-rubrique.dto';
import { ProgressionDomaineDto } from './dto/progression-domaine.dto';
import { ProgressionLeconDto } from './dto/progression-lecon.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedagogie/referentiel')
export class ReferentielController {
  constructor(private readonly referentielService: ReferentielService) {}

  @Get('niveaux/:niveauId/semestres')
  getSemestres(@Param('niveauId', ParseIntPipe) niveauId: number) {
    return this.referentielService.getSemestresParNiveau(niveauId);
  }

  // ---- Classe 1 ----
  @Get('ceintures/:ceintureId/domaines')
  getDomaines(@Param('ceintureId', ParseIntPipe) ceintureId: number) {
    return this.referentielService.getDomainesParCeinture(ceintureId);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Post('domaines')
  createDomaine(@Body() dto: CreateDomaineDto) {
    return this.referentielService.createDomaine(dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Post('sous-domaines')
  createSousDomaine(@Body() dto: CreateSousDomaineDto) {
    return this.referentielService.createSousDomaine(dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Post('competences')
  createCompetence(@Body() dto: CreateCompetenceDto) {
    return this.referentielService.createCompetence(dto);
  }

  // ---- Classe 2/3/college : Matiere ----
  @Get('matieres')
  listerMatieres() {
    return this.referentielService.listerMatieres();
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Post('matieres')
  creerMatiere(@Body() dto: CreateMatiereDto) {
    return this.referentielService.creerMatiere(dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Patch('matieres/:id')
  modifierMatiere(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMatiereDto) {
    return this.referentielService.modifierMatiere(id, dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Delete('matieres/:id')
  supprimerMatiere(@Param('id', ParseIntPipe) id: number) {
    return this.referentielService.supprimerMatiere(id);
  }

  // ---- Classe 2/3/college : Rubrique ----
  @Get('matieres/:matiereId/rubriques')
  listerRubriques(@Param('matiereId', ParseIntPipe) matiereId: number) {
    return this.referentielService.listerRubriques(matiereId);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Post('rubriques')
  creerRubrique(@Body() dto: CreateRubriqueDto) {
    return this.referentielService.creerRubrique(dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Patch('rubriques/:id')
  modifierRubrique(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRubriqueDto) {
    return this.referentielService.modifierRubrique(id, dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Delete('rubriques/:id')
  supprimerRubrique(@Param('id', ParseIntPipe) id: number) {
    return this.referentielService.supprimerRubrique(id);
  }

  // ---- Classe 2/3/college : Lecon ----
  @Get('ceintures/:ceintureId/lecons')
  getLecons(@Param('ceintureId', ParseIntPipe) ceintureId: number) {
    return this.referentielService.getLeconsParCeinture(ceintureId);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Post('lecons')
  createLecon(@Body() dto: CreateLeconDto) {
    return this.referentielService.createLecon(dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Patch('lecons/:id')
  modifierLecon(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeconDto) {
    return this.referentielService.modifierLecon(id, dto);
  }

  @Roles('ADMIN', 'DIRECTRICE')
  @Delete('lecons/:id')
  supprimerLecon(@Param('id', ParseIntPipe) id: number) {
    return this.referentielService.supprimerLecon(id);
  }

  // ---- Progression par salle ----
  @Roles('ADMIN', 'ENSEIGNANT', 'DIRECTRICE')
  @Post('progression/domaine')
  marquerDomaine(@Body() dto: ProgressionDomaineDto, @Req() req: any) {
    return this.referentielService.marquerDomaine(dto, req.user.personnelId);
  }

  @Roles('ADMIN', 'ENSEIGNANT', 'DIRECTRICE')
  @Post('progression/lecon')
  marquerLecon(@Body() dto: ProgressionLeconDto, @Req() req: any) {
    return this.referentielService.marquerLecon(dto, req.user.personnelId);
  }

  @Get('progression/salle/:salleId')
  getProgressionSalle(@Param('salleId', ParseIntPipe) salleId: number) {
    return this.referentielService.getProgressionSalle(salleId);
  }
}
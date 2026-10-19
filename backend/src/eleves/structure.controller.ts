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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StructureService } from './structure.service';
import { CreateClasseDto } from './dto/create-classe.dto';
import { UpdateClasseDto } from './dto/update-classe.dto';
import { CreateNiveauDto } from './dto/create-niveau.dto';
import { UpdateNiveauDto } from './dto/update-niveau.dto';
import { CreateSalleDto } from './dto/create-salle.dto';
import { UpdateSalleDto } from './dto/update-salle.dto';
import { CreateAnneeScolaireDto } from './dto/create-annee-scolaire.dto';
import { UpdateAnneeScolaireDto } from './dto/update-annee-scolaire.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('structure')
export class StructureController {
  constructor(private readonly structureService: StructureService) {}

  // ---- Année scolaire ----
  @Get('annees-scolaires')
  listerAnneesScolaires() {
    return this.structureService.listerAnneesScolaires();
  }

  @Roles('ADMIN')
  @Post('annees-scolaires')
  creerAnneeScolaire(@Body() dto: CreateAnneeScolaireDto, @Req() req: any) {
    return this.structureService.creerAnneeScolaire(dto, req.user?.id);
  }

  @Roles('ADMIN')
  @Patch('annees-scolaires/:id')
  modifierAnneeScolaire(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnneeScolaireDto,
    @Req() req: any,
  ) {
    return this.structureService.modifierAnneeScolaire(id, dto, req.user?.id);
  }

  @Roles('ADMIN')
  @Delete('annees-scolaires/:id')
  supprimerAnneeScolaire(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.structureService.supprimerAnneeScolaire(id, req.user?.id);
  }

  // ---- Classe ----
  @Get('classes')
  listerClasses() {
    return this.structureService.listerClasses();
  }

  @Roles('ADMIN')
  @Post('classes')
  creerClasse(@Body() dto: CreateClasseDto) {
    return this.structureService.creerClasse(dto);
  }

  @Roles('ADMIN')
  @Patch('classes/:id')
  modifierClasse(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClasseDto) {
    return this.structureService.modifierClasse(id, dto);
  }

  @Roles('ADMIN')
  @Delete('classes/:id')
  supprimerClasse(@Param('id', ParseIntPipe) id: number) {
    return this.structureService.supprimerClasse(id);
  }

  // ---- Niveau ----
  @Get('niveaux')
  listerNiveaux() {
    return this.structureService.listerNiveaux();
  }

  @Roles('ADMIN')
  @Post('niveaux')
  creerNiveau(@Body() dto: CreateNiveauDto) {
    return this.structureService.creerNiveau(dto);
  }

  @Roles('ADMIN')
  @Patch('niveaux/:id')
  modifierNiveau(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNiveauDto) {
    return this.structureService.modifierNiveau(id, dto);
  }

  @Roles('ADMIN')
  @Delete('niveaux/:id')
  supprimerNiveau(@Param('id', ParseIntPipe) id: number) {
    return this.structureService.supprimerNiveau(id);
  }

  // ---- Salle ----
  @Get('salles')
  listerSalles() {
    return this.structureService.listerSalles();
  }

  @Roles('ADMIN')
  @Post('salles')
  creerSalle(@Body() dto: CreateSalleDto) {
    return this.structureService.creerSalle(dto);
  }

  @Roles('ADMIN')
  @Patch('salles/:id')
  modifierSalle(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSalleDto) {
    return this.structureService.modifierSalle(id, dto);
  }

  @Roles('ADMIN')
  @Delete('salles/:id')
  supprimerSalle(@Param('id', ParseIntPipe) id: number) {
    return this.structureService.supprimerSalle(id);
  }
}
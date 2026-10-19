import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { EvaluationsService } from './evaluations.service';
import { NoteCompetenceDto } from './dto/note-competence.dto';
import { NoteLeconDto } from './dto/note-lecon.dto';
import { CreateExamenDto } from './dto/create-examen.dto';
import { NoteExamenDto } from './dto/note-examen.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedagogie/evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  // ---- Classe 1 : Domaine/SousDomaine/Competence ----
  @Roles('ENSEIGNANT', 'ADMIN')
  @Post('competence')
  saisirCompetence(@Body() dto: NoteCompetenceDto, @Req() req: any) {
    return this.evaluationsService.saisirNoteCompetence(dto, req.user.personnelId);
  }

  // ---- Classe 2/3/college : Matiere/Rubrique/Lecon ----
  @Roles('ENSEIGNANT', 'ADMIN')
  @Post('lecon')
  saisirLecon(@Body() dto: NoteLeconDto, @Req() req: any) {
    return this.evaluationsService.saisirNoteLecon(dto, req.user.personnelId);
  }

  // ---- Examens blancs (notes /20, en plus du bulletin A/EA/AR) ----
  @Roles('ENSEIGNANT', 'ADMIN', 'DIRECTRICE')
  @Post('examens')
  creerExamen(@Body() dto: CreateExamenDto) {
    return this.evaluationsService.creerExamen(dto);
  }

  @Roles('ENSEIGNANT', 'ADMIN')
  @Post('examens/:examenId/notes')
  saisirNoteExamen(
    @Param('examenId', ParseIntPipe) examenId: number,
    @Body() dto: NoteExamenDto,
    @Req() req: any,
  ) {
    return this.evaluationsService.saisirNoteExamen(examenId, dto, req.user.personnelId);
  }

  @Get('examens/:examenId/inscriptions/:inscriptionId/moyenne')
  getMoyenneExamen(
    @Param('examenId', ParseIntPipe) examenId: number,
    @Param('inscriptionId', ParseIntPipe) inscriptionId: number,
  ) {
    return this.evaluationsService.calculerMoyenneExamen(examenId, inscriptionId);
  }

  // ---- Vue unifiee ----
  @Get('inscriptions/:inscriptionId')
  getNotes(@Param('inscriptionId', ParseIntPipe) inscriptionId: number) {
    return this.evaluationsService.getNotesInscription(inscriptionId);
  }
}
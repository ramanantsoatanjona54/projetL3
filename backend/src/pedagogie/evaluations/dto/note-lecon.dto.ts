import { IsEnum, IsInt } from 'class-validator';
import { NiveauCompetenceDto } from './note-competence.dto';

export class NoteLeconDto {
  @IsInt()
  inscriptionId: number;

  @IsInt()
  leconId: number;

  @IsEnum(NiveauCompetenceDto)
  niveau: NiveauCompetenceDto;
}
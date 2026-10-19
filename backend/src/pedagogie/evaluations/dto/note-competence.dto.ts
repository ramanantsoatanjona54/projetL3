import { IsEnum, IsInt } from 'class-validator';

export enum NiveauCompetenceDto {
  A = 'A',
  EA = 'EA',
  AR = 'AR',
}

export class NoteCompetenceDto {
  @IsInt()
  inscriptionId: number;

  @IsInt()
  competenceId: number;

  @IsEnum(NiveauCompetenceDto)
  niveau: NiveauCompetenceDto;
}

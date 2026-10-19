import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class NoteExamenDto {
  @IsInt()
  inscriptionId: number;

  @IsInt()
  matiereId: number; // discipline notee, parmi celles de l'examen (route :examenId)

  @IsNumber()
  @Min(0)
  @Max(20)
  note: number;
}
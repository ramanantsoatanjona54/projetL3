import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRubriqueDto {
  @IsInt()
  matiereId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string; // Grammaire, Conjugaison, Orthographe, Expression orale/ecrite...
}
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateRubriqueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;
}
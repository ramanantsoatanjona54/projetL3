import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSalleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nom: string; // "1A", "1B", "2A", "3A", "3B"...

  @IsOptional()
  @IsInt()
  anneeScolaireId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  niveauIds?: number[]; // niveaux accueillis dans cette salle (une salle peut regrouper plusieurs niveaux)
}

import { IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSalleDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nom?: string;

  @IsOptional()
  @IsInt()
  anneeScolaireId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  niveauIds?: number[]; // remplace entierement la liste des niveaux de cette salle si fourni
}

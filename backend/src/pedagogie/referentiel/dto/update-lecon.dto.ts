import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

// Tous les champs sont optionnels : on ne modifie que ce qui est fourni.
export class UpdateLeconDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  titre?: string;

  @IsOptional()
  @IsInt()
  ordre?: number;

  @IsOptional()
  @IsInt()
  matiereId?: number;

  @IsOptional()
  @IsInt()
  rubriqueId?: number;

  @IsOptional()
  @IsInt()
  niveauId?: number;

  @IsOptional()
  @IsInt()
  ceintureId?: number;
}
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLeconDto {
  @IsInt()
  matiereId: number;

  @IsOptional()
  @IsInt()
  rubriqueId?: number;

  @IsInt()
  niveauId: number;

  @IsInt()
  ceintureId: number;

  @IsString()
  @IsNotEmpty()
  titre: string;

  @IsOptional()
  @IsInt()
  ordre?: number;
}

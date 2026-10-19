import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateNiveauDto {
  @IsOptional()
  @IsInt()
  classeId?: number; // deplacer un niveau vers une autre classe -- rare, a utiliser avec precaution

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nom?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ordre?: number;
}

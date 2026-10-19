import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCompetenceDto {
  @IsOptional()
  @IsInt()
  domaineId?: number;

  @IsOptional()
  @IsInt()
  sousDomaineId?: number;

  @IsString()
  @IsNotEmpty()
  libelle: string;
}

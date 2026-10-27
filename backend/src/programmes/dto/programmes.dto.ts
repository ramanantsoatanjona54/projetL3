import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class NomDto {
  @IsString() @MinLength(1) @MaxLength(150)
  nom: string;
}

export class CreerDomaineDto extends NomDto {
  @IsInt() @Min(1)
  ceintureId: number;
}

export class CreerSousDomaineDto extends NomDto {
  @IsInt() @Min(1)
  domaineId: number;
}

export class CreerRubriqueDto extends NomDto {
  @IsInt() @Min(1)
  matiereId: number;
}

export class LibelleDto {
  @IsString() @MinLength(1) @MaxLength(1000)
  libelle: string;
}

// Un domaine OU un sous-domaine (jamais les deux, vérifié par le service)
export class CreerCompetenceDto extends LibelleDto {
  @IsOptional() @IsInt() @Min(1)
  domaineId?: number;

  @IsOptional() @IsInt() @Min(1)
  sousDomaineId?: number;
}

export class CreerLeconDto {
  @IsInt() @Min(1) niveauId: number;
  @IsInt() @Min(1) ceintureId: number;
  @IsInt() @Min(1) matiereId: number;

  @IsOptional() @IsInt() @Min(1)
  rubriqueId?: number;

  @IsString() @MinLength(1) @MaxLength(500)
  titre: string;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  ordre?: number;
}

export class ModifierLeconDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500)
  titre?: string;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  ordre?: number;
}
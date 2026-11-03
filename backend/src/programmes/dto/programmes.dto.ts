import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { EstNomPropre } from '../../common/validation';

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

// ---------- Structure : semestres et ceintures (ADMIN) ----------

export class CreerSemestreDto {
  @IsInt() @Min(1)
  niveauId: number;

  @IsInt() @IsIn([1, 2])
  numero: number;
}

export class CreerCeintureDto {
  @IsInt() @Min(1)
  semestreId: number;

  @IsString() @EstNomPropre('Le nom de la ceinture', 60)
  nom: string;

  @IsOptional() @IsInt() @Min(0) @Max(99)
  ordre?: number;
}

export class ModifierCeintureDto {
  @IsOptional() @IsString() @EstNomPropre('Le nom de la ceinture', 60)
  nom?: string;

  @IsOptional() @IsInt() @Min(0) @Max(99)
  ordre?: number;
}

export class DeplacerCeintureDto {
  @IsInt() @Min(1)
  semestreId: number;
}

export class DeplacerLeconsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ArrayUnique()
  @IsInt({ each: true }) @Min(1, { each: true })
  leconIds: number[];

  @IsInt() @Min(1)
  ceintureId: number;
}

export class DeplacerDomainesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique()
  @IsInt({ each: true }) @Min(1, { each: true })
  domaineIds: number[];

  @IsInt() @Min(1)
  ceintureId: number;
}

export class DeplacerContenuDto {
  @IsInt() @Min(1)
  versCeintureId: number;
}
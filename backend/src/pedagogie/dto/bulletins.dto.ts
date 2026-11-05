import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsString, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';

export class AppreciationDto {
  @IsInt() @Min(1) @Max(2) semestre: number;
  @IsString() @MaxLength(1000, { message: "L'appréciation ne peut pas dépasser 1000 caractères." })
  appreciation: string;
}

export class PublicationDto {
  @IsInt() @Min(1) @Max(2) semestre: number;
  @IsBoolean() publie: boolean;
}

export class PublicationClasseDto {
  @IsInt() salleId: number;
  @IsInt() niveauId: number;
  @IsInt() @Min(1) @Max(2) semestre: number;
}

export class NoteLigneDto {
  @IsInt() @Min(1)
  elementId: number; // une ligne du contenu du bulletin

  // null explicite = retirer l'évaluation de cette ligne ; une valeur absente est refusée
  @ValidateIf((o) => o.niveau !== null)
  @IsIn(['A', 'EA', 'AR'])
  niveau: 'A' | 'EA' | 'AR' | null;
}

export class SaisirBulletinDto {
  @IsInt() @Min(1) @Max(2) semestre: number;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => NoteLigneDto)
  notes: NoteLigneDto[];
}
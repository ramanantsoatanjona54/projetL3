import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { TypeElementBulletin } from '@prisma/client';

export class CreerElementDto {
  @IsInt() @Min(1)
  semestreId: number;

  // Absent pour une discipline ; une rubrique a pour parent une discipline ; une ligne, une rubrique ou une discipline
  @IsOptional() @IsInt() @Min(1)
  parentId?: number;

  @IsEnum(TypeElementBulletin)
  type: TypeElementBulletin;

  @IsString() @MinLength(1) @MaxLength(300)
  libelle: string;
}

export class ModifierElementDto {
  @IsString() @MinLength(1) @MaxLength(300)
  libelle: string;
}

export class DeplacerElementDto {
  @IsInt() @Min(1)
  parentId: number;
}

export class OrdreElementDto {
  @IsIn(['haut', 'bas'])
  sens: 'haut' | 'bas';
}

export class CopierModeleDto {
  @IsInt() @Min(1)
  depuisSemestreId: number;
}
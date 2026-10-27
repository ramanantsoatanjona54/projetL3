import { OmitType, PartialType } from '@nestjs/mapped-types';
import { TypeInventaire } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const STOCK_MAX = 1_000_000;

export class CreerArticleDto {
  @IsString() @MinLength(2) @MaxLength(100)
  libelle: string;

  @IsEnum(TypeInventaire)
  type: TypeInventaire;

  @IsInt() @Min(0) @Max(STOCK_MAX)
  quantite: number; // quantité initiale
}

// La quantité ne se modifie jamais directement : uniquement par mouvements
export class ModifierArticleDto extends PartialType(OmitType(CreerArticleDto, ['quantite'] as const)) {}

export class MouvementDto {
  @IsInt() @Min(1) @Max(100_000)
  quantite: number;

  @IsOptional() @IsString() @MaxLength(200)
  motif?: string;
}
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, Matches, Max, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class DisciplineExamenDto {
  @IsInt() matiereId: number;
  @IsInt() @Min(1) @Max(10) coefficient: number;
}

export class CreerExamenDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date doit être au format AAAA-MM-JJ.' })
  date: string;

  @IsArray() @ArrayMinSize(1, { message: 'Ajoutez au moins une discipline.' }) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => DisciplineExamenDto)
  disciplines: DisciplineExamenDto[];
}

export class ModifierExamenDto extends PartialType(CreerExamenDto) {}

// Nouvelle discipline (matière) proposée au choix pour les examens
export class CreerMatiereDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @Matches(/^[\p{L}][\p{L}\p{M}' -]{1,59}$/u, { message: 'Nom invalide : 2 à 60 lettres (espaces, tirets et apostrophes autorisés).' })
  nom: string;
}

export class NoteExamenDto {
  @IsInt() inscriptionId: number;
  @IsInt() disciplineId: number;

  // null = retirer la note
  @ValidateIf((o) => o.note !== null)
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(20)
  note: number | null;
}

export class SaisirNotesExamenDto {
  @IsInt() salleId: number;

  @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => NoteExamenDto)
  notes: NoteExamenDto[];
}
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TYPES_DOSSIER, TYPES_PUBLICATION } from '../constantes';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MSG_DATE = { message: 'Date invalide (AAAA-MM-JJ).' };

// ---- Annonces ----
export class CreerPublicationDto {
  @IsString() @MinLength(3) @MaxLength(120)
  titre: string;

  @IsString() @MinLength(10) @MaxLength(5000)
  contenu: string;

  @IsIn([...TYPES_PUBLICATION])
  type: string;

  @IsBoolean()
  visiblePublic: boolean;
}
export class ModifierPublicationDto extends PartialType(CreerPublicationDto) {}

// ---- Documents (champs texte du formulaire multipart) ----
export class DeposerDossierDto {
  @IsString() @MinLength(3) @MaxLength(120)
  titre: string;

  @IsOptional() @IsIn([...TYPES_DOSSIER])
  type?: string;
}

// ---- Menu ----
export class PeriodeMenuDto {
  @IsString() @MinLength(3) @MaxLength(80)
  nom: string;

  @Matches(DATE, MSG_DATE)
  dateDebut: string;

  @Matches(DATE, MSG_DATE)
  dateFin: string;
}
export class ModifierPeriodeMenuDto extends PartialType(PeriodeMenuDto) {}

export class EnregistrerJourMenuDto {
  @Matches(DATE, MSG_DATE)
  date: string;

  @IsOptional() @IsString() @MaxLength(120)
  entree?: string;

  @IsOptional() @IsString() @MaxLength(120)
  platPrincipal?: string;

  @IsOptional() @IsString() @MaxLength(120)
  dessert?: string;
}
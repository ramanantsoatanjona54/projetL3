import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { POSTES } from '../postes';

export class CreatePersonnelDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nom: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  prenom: string;

  @IsOptional() @IsIn(['M', 'F'])
  sexe?: string;

  @IsOptional() @IsDateString()
  dateNaissance?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9\s.\-]{6,30}$/, { message: 'Le CIN doit contenir de 6 à 30 caractères (lettres, chiffres, espaces, points, tirets).' })
  cin?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adresse?: string;

  @IsOptional()
  @Matches(/^[0-9+\s().\-]{6,30}$/, { message: 'Numéro de téléphone invalide.' })
  telephone?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(10000000)
  indemniteTransportJour?: number;

  @IsOptional() @IsString() @MaxLength(50)
  numeroCnaps?: string;

  @IsIn([...POSTES], { message: 'Poste inconnu : choisissez un poste dans la liste.' })
  poste: string; // fonction

  @IsOptional() @IsInt()
  salleAffecteeId?: number; // emplacement / classe / salle habituelle

  @IsOptional() @IsString() @MaxLength(100)
  lieuAffectation?: string;

  @IsOptional() @IsBoolean()
  autorisationEnseigner?: boolean;

  @IsOptional() @IsString() @MaxLength(100)
  banque?: string;

  @IsDateString()
  dateEmbauche: string;

  @IsOptional() @IsDateString()
  dateDepart?: string;

  @IsOptional() @IsDateString()
  dateRetraite?: string;
}
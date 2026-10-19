import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePersonnelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  sexe?: string;

  @IsOptional()
  @IsDateString()
  dateNaissance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cin?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @IsOptional()
  @IsNumber()
  indemniteTransportJour?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroCnaps?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  poste: string; // fonction

  @IsOptional()
  @IsInt()
  salleAffecteeId?: number; // emplacement / classe / salle habituelle

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lieuAffectation?: string;

  @IsOptional()
  @IsBoolean()
  autorisationEnseigner?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  banque?: string;

  @IsDateString()
  dateEmbauche: string;

  @IsOptional()
  @IsDateString()
  dateDepart?: string;

  @IsOptional()
  @IsDateString()
  dateRetraite?: string;
}
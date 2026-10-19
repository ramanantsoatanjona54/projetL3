import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean
} from 'class-validator';

export class CreateEleveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom: string;

  @IsIn(['M', 'F'])
  sexe: string;

  @IsDateString()
  dateNaissance: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  numeroInscription?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateNaissance doit être une date valide (AAAA-MM-JJ)' })
  dateInscription?: string;

  @IsOptional()
  @IsNumber()
  taille?: number; // en cm

  @IsOptional()
  @IsString()
  dossiersManquants?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  assurance?: string;

  @IsOptional()
  @IsDateString()
  assuranceExpiration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @IsOptional()
  @IsEmail()
  email1?: string;

  @IsOptional()
  @IsEmail()
  email2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quartier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  professionPere?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  professionMere?: string;

    @IsOptional()
    @IsBoolean()
    confirmerHomonyme?: boolean; // vrai quand l'utilisateur confirme qu'il s'agit d'un autre élève

}
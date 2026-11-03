import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstNomPropre, EstTelephone } from '../../common/validation';

export class CreateEleveDto {
  @IsString()
  @IsNotEmpty()
  @EstNomPropre('Le nom')
  nom: string;

  @IsString()
  @IsNotEmpty()
  @EstNomPropre('Le prénom')
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
  @IsDateString({}, { message: "dateInscription doit être une date valide (AAAA-MM-JJ)" })
  dateInscription?: string;

  @IsOptional()
  @IsNumber()
  taille?: number; // en cm

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dossiersManquants?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  assurance?: string;

  @IsOptional()
  @IsDateString()
  assuranceExpiration?: string;

  // Contact de la famille : 10 chiffres (à la modification, doit être celui d'un responsable)
  @IsOptional()
  @EstTelephone()
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
  @EstNomPropre('La profession du père')
  professionPere?: string;

  @IsOptional()
  @IsString()
  @EstNomPropre('La profession de la mère')
  professionMere?: string;

  @IsOptional()
  @IsBoolean()
  confirmerHomonyme?: boolean; // vrai quand l'utilisateur confirme qu'il s'agit d'un autre élève
}
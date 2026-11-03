import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { POSTES } from '../postes';
import { EstNomPropre, EstNumeroChiffres, EstTelephone } from '../../common/validation';

// Longueurs maximales des numéros (chiffres uniquement) — à ajuster ici si besoin
const LONGUEUR_CIN = 12;
const LONGUEUR_NIF = 10;
const LONGUEUR_STATISTIQUE = 17;
const LONGUEUR_CNAPS = 12;

export class CreatePersonnelDto {
  @IsString() @IsNotEmpty() @EstNomPropre('Le nom')
  nom: string;

  @IsString() @IsNotEmpty() @EstNomPropre('Le prénom')
  prenom: string;

  @IsOptional() @IsIn(['M', 'F'])
  sexe?: string;

  @IsOptional() @IsDateString()
  dateNaissance?: string;

  @IsOptional() @EstNumeroChiffres('Le CIN', LONGUEUR_CIN)
  cin?: string;

  @IsOptional() @IsString() @MaxLength(255)
  adresse?: string;

  @IsOptional() @EstTelephone()
  telephone?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(10000000)
  indemniteTransportJour?: number;

  @IsOptional() @EstNumeroChiffres('Le numéro CNaPS', LONGUEUR_CNAPS)
  numeroCnaps?: string;

  @IsOptional() @IsIn(['SALARIE', 'CONSULTANT'])
  typePersonnel?: string;

  @IsOptional() @EstNumeroChiffres('Le NIF', LONGUEUR_NIF)
  nif?: string;

  @IsOptional() @EstNumeroChiffres('Le numéro statistique', LONGUEUR_STATISTIQUE)
  numeroStatistique?: string;

  @IsIn([...POSTES], { message: 'Poste inconnu : choisissez un poste dans la liste.' })
  poste: string; // fonction

  @IsOptional() @IsInt()
  salleAffecteeId?: number; // emplacement / classe / salle habituelle

  @IsOptional() @IsString() @MaxLength(100)
  lieuAffectation?: string;

  @IsOptional() @IsBoolean()
  autorisationEnseigner?: boolean;

  @IsOptional() @IsString() @EstNomPropre('La banque')
  banque?: string;

  @IsDateString()
  dateEmbauche: string;

  @IsOptional() @IsDateString()
  dateDepart?: string;

  @IsOptional() @IsDateString()
  dateRetraite?: string;
}
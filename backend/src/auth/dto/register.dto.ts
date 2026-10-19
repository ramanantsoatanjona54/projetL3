import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, MinLength , MaxLength } from 'class-validator';
import { RoleUtilisateur } from '@prisma/client';
import { MESSAGE_MOT_DE_PASSE, REGEX_MOT_DE_PASSE } from '../politique-mot-de-passe';

export class RegisterDto {
  @IsEmail()
  email: string;

  // Politique de mot de passe fort : min 8 caractères, au moins 1 majuscule, 1 chiffre
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une majuscule et un chiffre',
  })
  motDePasse: string;

  @IsEnum(RoleUtilisateur)
  role: RoleUtilisateur;

  @IsOptional()
  @IsInt()
  personnelId?: number;

  @IsOptional()
  @IsInt()
  parentId?: number;
  
  @IsString() @MinLength(1) @MaxLength(128)
  ancienMotDePasse: string;

  @IsString()
  @Matches(REGEX_MOT_DE_PASSE, { message: MESSAGE_MOT_DE_PASSE })
  nouveauMotDePasse: string;

}

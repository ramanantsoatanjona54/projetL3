import { IsBoolean, IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { RoleUtilisateur } from '@prisma/client';

export class UpdateUtilisateurDto {
  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string;

  @IsOptional() @IsEnum(RoleUtilisateur)
  role?: RoleUtilisateur;

  @IsOptional() @IsBoolean()
  actif?: boolean;
}
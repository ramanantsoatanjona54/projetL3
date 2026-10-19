import { IsEmail, IsEnum, IsInt, IsOptional, MaxLength } from 'class-validator';
import { RoleUtilisateur } from '@prisma/client';

export class CreateUtilisateurDto {
  @IsEmail() @MaxLength(120)
  email: string;

  @IsEnum(RoleUtilisateur)
  role: RoleUtilisateur;

  @IsOptional() @IsInt()
  personnelId?: number;
}
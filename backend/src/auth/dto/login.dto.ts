import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() @MaxLength(254)
  email: string;

  // Pas de longueur minimale élevée ici : un mot de passe faux, court ou long, doit toujours produire le même 401 et compter comme un essai
  @IsString() @MinLength(1) @MaxLength(128)
  motDePasse: string;
}
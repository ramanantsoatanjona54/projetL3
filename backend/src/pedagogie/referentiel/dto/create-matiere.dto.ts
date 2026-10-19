import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMatiereDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string; // Francais, Calcul, Eveil, Malgache, (college) SVT, Histoire-Geo...
}
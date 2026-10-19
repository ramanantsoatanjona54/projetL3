import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnneeScolaireDto {
  @IsString() @MinLength(3) @MaxLength(30)
  libelle: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;
}
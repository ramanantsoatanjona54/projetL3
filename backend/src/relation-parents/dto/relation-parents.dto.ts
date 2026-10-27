import { IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class DemanderRendezVousDto {
  @IsInt()
  interlocuteurId: number; // identifiant du COMPTE de la personne demandée

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide (AAAA-MM-JJ).' })
  date: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'Heure invalide (HH:MM).' })
  heure: string;

  @IsOptional() @IsString() @MaxLength(300)
  motif?: string;
}

export class RaisonDto {
  @IsOptional() @IsString() @MaxLength(200)
  raison?: string;
}

export class EnvoyerRemarqueDto {
  @IsString() @MinLength(10, { message: 'La remarque doit contenir au moins 10 caractères.' }) @MaxLength(1000)
  contenu: string;
}
import { IsInt, IsISO8601, IsOptional, Matches } from 'class-validator';

export class CorrigerPointageDto {
  @IsOptional() @IsISO8601()
  heureArrivee?: string;

  // null = effacer l'heure de départ
  @IsOptional() @IsISO8601()
  heureDepart?: string | null;
}

export class CreerPointageManuelDto {
  @IsInt()
  personnelId: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide (AAAA-MM-JJ).' })
  date: string;

  @IsISO8601()
  heureArrivee: string;

  @IsOptional() @IsISO8601()
  heureDepart?: string;
}

// L'annulation ne demande plus de motif : la trace (qui, quand, quelles heures) est dans le journal.
export class AnnulerPointageDto {}
import { IsInt, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CorrigerPointageDto {
  @IsOptional() @IsISO8601()
  heureArrivee?: string;

  // null = effacer l'heure de départ
  @IsOptional() @IsISO8601()
  heureDepart?: string | null;

  @IsString() @MinLength(5) @MaxLength(200)
  motif: string;
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

  @IsString() @MinLength(5) @MaxLength(200)
  motif: string;
}

export class AnnulerPointageDto {
  @IsString() @MinLength(5) @MaxLength(200)
  motif: string;
}
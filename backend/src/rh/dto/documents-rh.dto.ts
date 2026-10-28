import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Données complémentaires saisies au moment de générer le document
// (ce qui n'est pas dans la fiche du personnel). Toutes facultatives ici ;
// le service exige celles qui sont indispensables pour chaque modèle.
export class GenererDocumentDto {
  @IsOptional() @IsString() @MaxLength(40) nationalite?: string;
  @IsOptional() @IsString() @MaxLength(80) lieuNaissance?: string;
  @IsOptional() @IsString() @MaxLength(200) cinDelivrance?: string;
  @IsOptional() @IsString() @MaxLength(120) pere?: string;
  @IsOptional() @IsString() @MaxLength(120) mere?: string;
  @IsOptional() @IsString() @MaxLength(10) classification?: string;
  @IsOptional() @Matches(DATE_ISO, { message: 'Date d’effet invalide.' }) dateEffet?: string;
  @IsOptional() @Matches(DATE_ISO, { message: 'Date de signature invalide.' }) dateSignature?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) salaireBase?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) anciennete?: number;
  @IsOptional() @IsIn(['CDI', 'CDD']) natureContrat?: 'CDI' | 'CDD';
}
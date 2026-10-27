import { IsBoolean, IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class AffecterEnseignantDto {
  // null = retirer l'enseignant de la salle
  @ValidateIf((o) => o.personnelId !== null)
  @IsInt() @Min(1)
  personnelId: number | null;

  // true = l'administrateur a confirmé un remplacement ou un déplacement
  @IsOptional() @IsBoolean()
  remplacer?: boolean;
}
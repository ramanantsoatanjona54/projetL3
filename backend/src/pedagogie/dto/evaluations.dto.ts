import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, ValidateIf, ValidateNested } from 'class-validator';

export class NoteEleveDto {
  @IsInt()
  inscriptionId: number;

  // null explicite = retirer l'évaluation de cet élève ; une valeur absente est refusée
  @ValidateIf((o) => o.niveau !== null)
  @IsIn(['A', 'EA', 'AR'])
  niveau: 'A' | 'EA' | 'AR' | null;
}

export class SaisirEvaluationsDto {
  @IsInt() salleId: number;
  @IsInt() niveauId: number;
  @IsInt() elementId: number; // compétence (Classe 1) ou leçon (Classes 2 et 3)

  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => NoteEleveDto)
  notes: NoteEleveDto[];
}

export class SuiviDto {
  @IsInt() salleId: number;
  @IsInt() niveauId: number;
  @IsInt() cibleId: number; // domaine (Classe 1) ou leçon (Classes 2 et 3)

  @IsIn(['vu', 'en_cours', 'termine', 'aucun'])
  etat: 'vu' | 'en_cours' | 'termine' | 'aucun';
}
import { IsIn, IsInt } from 'class-validator';

// Suivi de classe : « vu en classe » (leçons) ou avancement d'un domaine (prescolaire). Aucune note d'élève ici.
export class SuiviDto {
  @IsInt() salleId: number;
  @IsInt() niveauId: number;
  @IsInt() cibleId: number; // domaine (Classe 1) ou leçon (Classes 2 et 3)

  @IsIn(['vu', 'en_cours', 'termine', 'aucun'])
  etat: 'vu' | 'en_cours' | 'termine' | 'aucun';
}
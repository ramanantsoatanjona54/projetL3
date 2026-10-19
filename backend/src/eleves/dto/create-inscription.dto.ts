import { IsInt } from 'class-validator';

// Le rang de fratrie et le statut ne viennent plus jamais du client : le serveur les calcule.
export class CreateInscriptionDto {
  @IsInt() eleveId: number;
  @IsInt() niveauId: number;
  @IsInt() salleId: number;
  @IsInt() anneeScolaireId: number;
}
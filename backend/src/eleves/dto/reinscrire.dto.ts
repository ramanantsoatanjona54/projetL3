import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class LigneReinscriptionDto {
  @IsInt() @Min(1) eleveId!: number;
  @IsInt() @Min(1) niveauId!: number;
  @IsInt() @Min(1) salleId!: number;
}

export class ReinscrireDto {
  @IsInt() @Min(1) anneeScolaireId!: number;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LigneReinscriptionDto)
  lignes!: LigneReinscriptionDto[];
}

export class OuvrirSallesDto {
  @IsInt() @Min(1) anneeScolaireId!: number;
}
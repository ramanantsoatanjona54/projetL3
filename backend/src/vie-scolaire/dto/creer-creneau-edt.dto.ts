import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreerCreneauEDTDto {
  @Type(() => Number) @IsInt() salleId: number;
  @Type(() => Number) @IsInt() niveauId: number;
  @Type(() => Number) @IsInt() anneeScolaireId: number;
  @IsOptional() @Type(() => Number) @IsInt() matiereId?: number;
  @IsOptional() @Type(() => Number) @IsInt() enseignantId?: number;
  @Type(() => Number) @IsInt() jourSemaine: number; // 1=lundi ... 5=vendredi
  @IsString() heureDebut: string;
  @IsString() heureFin: string;
  @IsOptional() @IsString() titre?: string;
}
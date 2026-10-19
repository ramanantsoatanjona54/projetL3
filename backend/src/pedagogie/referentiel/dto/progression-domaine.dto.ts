import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class ProgressionDomaineDto {
  @IsInt()
  domaineId: number;

  @IsInt()
  salleId: number;

  @IsOptional()
  @IsString()
  @IsIn(['en_cours', 'termine'])
  statut?: string;
}

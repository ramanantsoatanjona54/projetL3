import { IsEnum, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { ModePaiement } from '@prisma/client';

export class CreatePaiementDto {
  @IsInt() inscriptionId: number;

  @IsEnum(ModePaiement) mode: ModePaiement;

  @ValidateIf((o) => o.mode === ModePaiement.MENSUEL)
  @IsInt() @Min(1) @Max(12)
  moisConcerne?: number;
}
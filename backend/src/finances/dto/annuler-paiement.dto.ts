import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnnulerPaiementDto {
  @IsString() @MinLength(5) @MaxLength(200)
  motif: string;
}
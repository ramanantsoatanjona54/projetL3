import { IsInt, Max, Min } from 'class-validator';

export class UpdateFraisDto {
  @IsInt() @Min(1) @Max(100000000)
  montant: number;
}
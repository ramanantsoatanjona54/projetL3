import { IsInt, Max, Min } from 'class-validator';

export class UpdateRemiseFraterniteDto {
  @IsInt() @Min(1) @Max(100000000)
  montant: number;
}
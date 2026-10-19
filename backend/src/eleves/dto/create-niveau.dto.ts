import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateNiveauDto {
  @IsInt()
  classeId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  nom: string; // PS, MS, GS, 11e, 10e, 9e, 8e, 7e, (futur) 6e, 5e...

  @IsInt()
  @Min(1)
  ordre: number; // ordre au sein de la classe
}

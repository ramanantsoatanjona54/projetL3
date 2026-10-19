import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class DisciplineExamenDto {
  @IsInt()
  matiereId: number;

  @IsInt()
  @Min(1)
  coefficient: number;
}

export class CreateExamenDto {
  @IsInt()
  niveauId: number;

  @IsInt()
  anneeScolaireId: number;

  @IsInt()
  @Min(1)
  numero: number; // 1, 2, 3, 4...

  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DisciplineExamenDto)
  disciplines: DisciplineExamenDto[]; // { matiereId, coefficient }[]
}
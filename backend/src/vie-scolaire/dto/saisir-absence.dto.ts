import { Type } from 'class-transformer';
import { IsDateString, IsInt } from 'class-validator';

export class SaisirAbsenceDto {
  @Type(() => Number) @IsInt() inscriptionId: number;
  @IsDateString() date: string;
}
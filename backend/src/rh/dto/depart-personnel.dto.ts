import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class DepartPersonnelDto {
  @IsDateString()
  dateDepart: string;

  @IsOptional() @IsBoolean()
  desactiverCompte?: boolean;
}
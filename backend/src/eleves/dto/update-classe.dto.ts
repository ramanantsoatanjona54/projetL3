import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateClasseDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nom?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ordre?: number;

  @IsOptional()
  @IsIn(['prescolaire', 'primaire_1', 'primaire_2', 'college'])
  cycle?: string;
}

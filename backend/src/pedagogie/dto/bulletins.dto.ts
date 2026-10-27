import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class AppreciationDto {
  @IsInt() @Min(1) @Max(2) semestre: number;
  @IsString() @MaxLength(1000, { message: "L'appréciation ne peut pas dépasser 1000 caractères." })
  appreciation: string;
}

export class PublicationDto {
  @IsInt() @Min(1) @Max(2) semestre: number;
  @IsBoolean() publie: boolean;
}

export class PublicationClasseDto {
  @IsInt() salleId: number;
  @IsInt() niveauId: number;
  @IsInt() @Min(1) @Max(2) semestre: number;
}
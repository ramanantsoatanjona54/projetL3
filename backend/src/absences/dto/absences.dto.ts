import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SaisirAppelDto {
  @IsInt()
  salleId: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide (AAAA-MM-JJ).' })
  date: string;

  // Identifiants des INSCRIPTIONS des élèves absents ce jour-là
  @IsArray() @ArrayMaxSize(200) @IsInt({ each: true })
  inscriptionIdsAbsents: number[];

  // Élèves arrivés en retard (présents, mais en retard) : jamais en même temps absents
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsInt({ each: true })
  inscriptionIdsRetard?: number[];
}

export class JustifierAbsenceDto {
  @IsString() @MinLength(5) @MaxLength(200)
  motif: string;
}
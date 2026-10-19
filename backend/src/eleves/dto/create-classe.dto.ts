import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateClasseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nom: string; // "Classe 1", "Classe 2", "Classe 3", (futur) "Classe 4"

  @IsInt()
  @Min(1)
  ordre: number;

  @IsIn(['prescolaire', 'primaire_1', 'primaire_2', 'college'])
  cycle: string;
}

import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateDomaineDto {
  @IsInt()
  ceintureId: number;

  @IsString()
  @IsNotEmpty()
  nom: string;
}

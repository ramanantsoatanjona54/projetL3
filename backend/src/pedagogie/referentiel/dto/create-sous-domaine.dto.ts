import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateSousDomaineDto {
  @IsInt()
  domaineId: number;

  @IsString()
  @IsNotEmpty()
  nom: string;
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateMatiereDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;
}
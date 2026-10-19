import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class GenererBulletinDto {
  @IsInt()
  inscriptionId: number;

  @IsString()
  @IsNotEmpty()
  periode: string; // "Semestre 1" | "Semestre 2"
}

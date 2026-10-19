import { IsInt } from 'class-validator';

export class ProgressionLeconDto {
  @IsInt()
  leconId: number;

  @IsInt()
  salleId: number;
}

import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { TypeInventaire } from '@prisma/client';

export class CreateInventaireDto {
  @IsString() @IsNotEmpty() libelle: string;
  @IsEnum(TypeInventaire) type: TypeInventaire;
  @IsInt() @Min(0) quantite: number;
}
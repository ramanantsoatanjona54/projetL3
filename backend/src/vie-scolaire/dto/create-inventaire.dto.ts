import { IsEnum, IsInt, IsNotEmpty, IsString, Min ,MaxLength } from 'class-validator';
import { TypeInventaire } from '@prisma/client';

export class CreateInventaireDto {
  @IsString() @IsNotEmpty() @MaxLength(120) libelle: string;
  @IsEnum(TypeInventaire) type: TypeInventaire;
  @IsInt() @Min(0) quantite: number;
}
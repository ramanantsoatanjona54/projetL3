import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MSG_HEURE = { message: 'Heure invalide (HH:MM).' };

export class CreerCreneauDto {
  @IsInt() salleId: number;
  @IsInt() niveauId: number;
  @IsInt() @Min(1) @Max(5) jourSemaine: number; // 1 = lundi ... 5 = vendredi
  @Matches(HEURE, MSG_HEURE) heureDebut: string;
  @Matches(HEURE, MSG_HEURE) heureFin: string;
  @IsOptional() @IsInt() matiereId?: number;
  @IsOptional() @IsInt() enseignantId?: number;
  @IsOptional() @IsString() @MaxLength(60) titre?: string;
}

// La salle et le niveau d'un créneau ne changent pas : pour les changer, on supprime et on recrée
export class ModifierCreneauDto extends PartialType(OmitType(CreerCreneauDto, ['salleId', 'niveauId'] as const)) {}
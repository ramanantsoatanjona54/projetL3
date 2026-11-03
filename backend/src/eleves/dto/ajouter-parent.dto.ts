import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EstNomPropre, EstTelephone } from '../../common/validation';

export class AjouterParentDto {
  @IsString()
  @IsNotEmpty()
  @EstNomPropre('Le nom')
  nom: string;

  @IsString()
  @IsNotEmpty()
  @EstNomPropre('Le prénom')
  prenom: string;

  @IsString()
  @IsNotEmpty()
  @EstTelephone()
  telephone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsIn(['pere', 'mere', 'tuteur'], { message: 'Le lien doit être : père, mère ou tuteur.' })
  lienParente: string; // "pere" | "mere" | "tuteur"
}
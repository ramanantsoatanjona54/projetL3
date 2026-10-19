import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MESSAGE_MOT_DE_PASSE, REGEX_MOT_DE_PASSE } from '../politique-mot-de-passe';

export class ChangerMotDePasseDto {
  @IsString() @MinLength(1) @MaxLength(128)
  ancienMotDePasse: string;

  @IsString()
  @Matches(REGEX_MOT_DE_PASSE, { message: MESSAGE_MOT_DE_PASSE })
  nouveauMotDePasse: string;
}
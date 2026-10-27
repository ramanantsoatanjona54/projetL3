import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CodeDto {
  @IsString() @Matches(/^[A-Za-z0-9 -]{6,14}$/, { message: 'Code invalide.' })
  code: string;
}

export class Verifier2faDto extends CodeDto {
  @IsString() @MaxLength(1000)
  jetonDefi: string;
}

export class ConfirmationDto extends CodeDto {
  @IsString() @MinLength(1) @MaxLength(128)
  motDePasse: string;
}
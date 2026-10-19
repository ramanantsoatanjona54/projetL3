import { PartialType } from '@nestjs/mapped-types';
import { CreateEleveDto } from './create-eleve.dto';

export class UpdateEleveDto extends PartialType(CreateEleveDto) {}
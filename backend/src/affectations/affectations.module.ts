import { Module } from '@nestjs/common';
import { AffectationsController } from './affectations.controller';
import { AffectationsService } from './affectations.service';

@Module({ controllers: [AffectationsController], providers: [AffectationsService] })
export class AffectationsModule {}
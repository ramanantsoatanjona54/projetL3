import { Module } from '@nestjs/common';
import { RhController } from './rh.controller';
import { RhService } from './rh.service';
import { PointageService } from './pointage.service';
import { DocumentsRhController } from './documents-rh.controller';
import { DocumentsRhService } from './documents-rh.service';

@Module({
  controllers: [RhController, DocumentsRhController],
  providers: [RhService, PointageService, DocumentsRhService],
})
export class RhModule {}
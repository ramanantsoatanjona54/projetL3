import { Module } from '@nestjs/common';
import { ElevesController } from './eleves.controller';
import { ElevesService } from './eleves.service';
import { InscriptionsController } from './inscriptions.controller';
import { InscriptionsService } from './inscriptions.service';
import { StructureController } from './structure.controller';
import { StructureService } from './structure.service';

@Module({
  controllers: [ElevesController, InscriptionsController, StructureController],
  providers: [ElevesService, InscriptionsService, StructureService],
  exports: [ElevesService, InscriptionsService, StructureService],
})
export class ElevesModule {}

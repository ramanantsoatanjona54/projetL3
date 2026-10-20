import { Module } from '@nestjs/common';
import { RhController } from './rh.controller';
import { RhService } from './rh.service';
import { PointageService } from './pointage.service';

@Module({
  controllers: [RhController],
  providers: [RhService, PointageService],
})
export class RhModule {}
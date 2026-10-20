import { Module } from '@nestjs/common';
import { FinancesModule } from '../finances/finances.module';
import { AbsencesController } from './absences.controller';
import { ParentAbsencesController } from './parent-absences.controller';
import { AbsencesService } from './absences.service';

@Module({
  imports: [FinancesModule],
  controllers: [AbsencesController, ParentAbsencesController],
  providers: [AbsencesService],
})
export class AbsencesModule {}
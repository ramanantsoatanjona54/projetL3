import { Module } from '@nestjs/common';
import { FinancesModule } from '../finances/finances.module';
import { EmploiDuTempsController } from './emploi-du-temps.controller';
import { ParentEdtController } from './parent-edt.controller';
import { EmploiDuTempsService } from './emploi-du-temps.service';

@Module({
  imports: [FinancesModule],
  controllers: [EmploiDuTempsController, ParentEdtController],
  providers: [EmploiDuTempsService],
})
export class EmploiDuTempsModule {}
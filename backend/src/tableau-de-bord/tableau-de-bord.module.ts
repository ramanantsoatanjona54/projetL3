import { Module } from '@nestjs/common';
import { FinancesModule } from '../finances/finances.module';
import { AuditModule } from '../audit/audit.module';
import { TableauDeBordController } from './tableau-de-bord.controller';
import { TableauDeBordService } from './tableau-de-bord.service';

@Module({
  imports: [FinancesModule, AuditModule],
  controllers: [TableauDeBordController],
  providers: [TableauDeBordService],
})
export class TableauDeBordModule {}
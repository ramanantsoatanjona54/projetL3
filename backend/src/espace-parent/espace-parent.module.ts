import { Module } from '@nestjs/common';
import { FinancesModule } from '../finances/finances.module';
import { EspaceParentController } from './espace-parent.controller';
import { EspaceParentService } from './espace-parent.service';

@Module({
  imports: [FinancesModule],
  controllers: [EspaceParentController],
  providers: [EspaceParentService],
})
export class EspaceParentModule {}
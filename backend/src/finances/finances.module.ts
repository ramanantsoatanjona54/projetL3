import { Module } from '@nestjs/common';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';

@Module({
  controllers: [FinancesController],
  providers: [FinancesService],
  exports: [FinancesService], // réutilisé par le module Élèves (statut paiement à l'inscription)
})
export class FinancesModule {}

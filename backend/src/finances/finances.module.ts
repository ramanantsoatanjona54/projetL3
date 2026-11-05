import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { FinancesController } from './finances.controller';
import { FinancesService } from './finances.service';
import { RappelsService } from './rappels.service';

@Module({
  imports: [MailModule],
  controllers: [FinancesController],
  providers: [FinancesService, RappelsService],
  exports: [FinancesService], // réutilisé par le module Élèves (statut paiement à l'inscription)
})
export class FinancesModule {}
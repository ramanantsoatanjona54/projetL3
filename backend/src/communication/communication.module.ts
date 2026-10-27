import { Module } from '@nestjs/common';
import { PublicationsController } from './publications.controller';
import { DossiersController } from './dossiers.controller';
import { MenuController } from './menu.controller';
import { PublicationsService } from './publications.service';
import { DossiersService } from './dossiers.service';
import { MenuService } from './menu.service';

@Module({
  controllers: [PublicationsController, DossiersController, MenuController],
  providers: [PublicationsService, DossiersService, MenuService],
})
export class CommunicationModule {}
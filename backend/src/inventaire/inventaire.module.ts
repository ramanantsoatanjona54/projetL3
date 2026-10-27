import { Module } from '@nestjs/common';
import { InventaireController } from './inventaire.controller';
import { InventaireService } from './inventaire.service';

@Module({ controllers: [InventaireController], providers: [InventaireService] })
export class InventaireModule {}
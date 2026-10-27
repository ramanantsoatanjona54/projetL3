import { Module } from '@nestjs/common';
import { EspaceEnseignantController } from './espace-enseignant.controller';
import { EspaceEnseignantService } from './espace-enseignant.service';

@Module({ controllers: [EspaceEnseignantController], providers: [EspaceEnseignantService] })
export class EspaceEnseignantModule {}
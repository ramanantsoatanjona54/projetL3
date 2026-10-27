import { Module } from '@nestjs/common';
import { ParentRelationController } from './parent-relation.controller';
import { RendezVousController } from './rendez-vous.controller';
import { RemarquesController } from './remarques.controller';
import { RendezVousService } from './rendez-vous.service';
import { RemarquesService } from './remarques.service';

@Module({
  controllers: [ParentRelationController, RendezVousController, RemarquesController],
  providers: [RendezVousService, RemarquesService],
})
export class RelationParentsModule {}
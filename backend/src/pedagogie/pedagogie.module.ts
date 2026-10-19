import { Module } from '@nestjs/common';
import { ReferentielController } from './referentiel/referentiel.controller';
import { ReferentielService } from './referentiel/referentiel.service';
import { EvaluationsController } from './evaluations/evaluations.controller';
import { EvaluationsService } from './evaluations/evaluations.service';
import { BulletinsController } from './bulletins/bulletins.controller';
import { BulletinsService } from './bulletins/bulletins.service';

@Module({
  controllers: [ReferentielController, EvaluationsController, BulletinsController],
  providers: [ReferentielService, EvaluationsService, BulletinsService],
  exports: [ReferentielService, EvaluationsService, BulletinsService],
})
export class PedagogieModule {}

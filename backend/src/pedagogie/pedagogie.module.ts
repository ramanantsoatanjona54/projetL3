import { Module } from '@nestjs/common';
import { BulletinsController, ParentBulletinsController } from './bulletins.controller';
import { BulletinsService } from './bulletins.service';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { ExamensController } from './examens.controller';
import { ExamensService } from './examens.service';

@Module({
  controllers: [EvaluationsController, ExamensController, BulletinsController, ParentBulletinsController],
  providers: [EvaluationsService, ExamensService, BulletinsService],
  exports: [EvaluationsService, ExamensService, BulletinsService],
})
export class PedagogieModule {}
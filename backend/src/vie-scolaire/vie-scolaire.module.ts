import { Module } from '@nestjs/common';
import { VieScolaireController } from './vie-scolaire.controller';
import { VieScolaireService } from './vie-scolaire.service';

@Module({
  controllers: [VieScolaireController],
  providers: [VieScolaireService],
})
export class VieScolaireModule {}

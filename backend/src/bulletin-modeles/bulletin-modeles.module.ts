import { Module } from '@nestjs/common';
import { BulletinModelesController } from './bulletin-modeles.controller';
import { BulletinModelesService } from './bulletin-modeles.service';

@Module({
  controllers: [BulletinModelesController],
  providers: [BulletinModelesService],
})
export class BulletinModelesModule {}
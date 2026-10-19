import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() : pas besoin de ré-importer PrismaModule dans chaque module métier,
// PrismaService est injectable partout une fois ce module chargé dans AppModule.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

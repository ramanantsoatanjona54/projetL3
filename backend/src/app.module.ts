import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FinancesModule } from './finances/finances.module';
import { ElevesModule } from './eleves/eleves.module';
import { RhModule } from './rh/rh.module';
import { PedagogieModule } from './pedagogie/pedagogie.module';
import { VieScolaireModule } from './vie-scolaire/vie-scolaire.module';
import { UtilisateursModule } from './utilisateurs/utilisateurs.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    FinancesModule,
    ElevesModule,
    RhModule,
    PedagogieModule,
    VieScolaireModule,
    UtilisateursModule, // <- à ajouter
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
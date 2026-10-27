import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FinancesModule } from './finances/finances.module';
import { ElevesModule } from './eleves/eleves.module';
import { RhModule } from './rh/rh.module';
import { PedagogieModule } from './pedagogie/pedagogie.module';
import { UtilisateursModule } from './utilisateurs/utilisateurs.module';
import { EspaceParentModule } from './espace-parent/espace-parent.module';
import { AuditModule } from './audit/audit.module';
import { TableauDeBordModule } from './tableau-de-bord/tableau-de-bord.module';
import { AbsencesModule } from './absences/absences.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RelationParentsModule } from './relation-parents/relation-parents.module';
import { CommunicationModule } from './communication/communication.module';
import { EmploiDuTempsModule } from './emplois-du-temps/emploi-du-temps.module';
import { InventaireModule } from './inventaire/inventaire.module';
import { EspaceEnseignantModule } from './espace-enseignant/espace-enseignant.module';
import { SessionThrottlerGuard } from './common/session-throttler.guard';
import { AffectationsModule } from './affectations/affectations.module';
import { ProgrammesModule } from './programmes/programmes.module';
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    FinancesModule,
    ElevesModule,
    RhModule,
    PedagogieModule,
    UtilisateursModule,
    EspaceParentModule,
    AuditModule,
    TableauDeBordModule,
    AbsencesModule,
    NotificationsModule,
    RelationParentsModule,
    CommunicationModule,
    EmploiDuTempsModule,
    InventaireModule,
    EspaceEnseignantModule,
    AffectationsModule,
    ProgrammesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: SessionThrottlerGuard }],
})
export class AppModule {}
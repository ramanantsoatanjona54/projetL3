import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY, TOUS_ROLES_KEY } from '../decorators/roles.decorator';

const MESSAGE = "Vous n'avez pas les droits nécessaires pour cette action";
const ANTI_REPETITION_MS = 60_000;

// Moindre privilège, REFUS PAR DÉFAUT : une route sans @Roles ni @TousRoles() est interdite à tous.
// Se place APRÈS JwtAuthGuard (il faut req.user). Chaque refus d'un utilisateur connecté est tracé.
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  private readonly derniersRefus = new Map<string, number>();

  constructor(private readonly reflector: Reflector, private readonly moduleRef: ModuleRef) {}

  canActivate(context: ExecutionContext): boolean {
    const cibles = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<RoleUtilisateur[]>(ROLES_KEY, cibles);
    const tousRoles = this.reflector.getAllAndOverride<boolean>(TOUS_ROLES_KEY, cibles);
    const { user } = context.switchToHttp().getRequest();

    if (!user) throw new ForbiddenException(MESSAGE);

    if (!requiredRoles || requiredRoles.length === 0) {
      if (tousRoles) return true;
      this.logger.warn(`Route sans @Roles refusée : ${context.getClass().name}.${context.getHandler().name}`);
      this.tracerRefus(context, user);
      throw new ForbiddenException(MESSAGE);
    }

    if (!requiredRoles.includes(user.role)) {
      this.tracerRefus(context, user);
      throw new ForbiddenException(MESSAGE);
    }
    return true;
  }

  // Écriture en arrière-plan : elle ne ralentit jamais la réponse et ne peut pas la faire échouer.
  // Une seule ligne par utilisateur, route et minute : un utilisateur qui martèle une route ne sature pas le journal.
  private tracerRefus(context: ExecutionContext, user: { id: number; role: RoleUtilisateur }): void {
    try {
      const req = context.switchToHttp().getRequest();
      const chemin = String(req.route?.path ?? req.path ?? '').slice(0, 120); // modèle de route, sans paramètres ni requête
      const cle = `${user.id}|${req.method}|${chemin}`;
      const maintenant = Date.now();
      if (maintenant - (this.derniersRefus.get(cle) ?? 0) < ANTI_REPETITION_MS) return;
      if (this.derniersRefus.size > 2000) this.derniersRefus.clear();
      this.derniersRefus.set(cle, maintenant);

      const prisma = this.moduleRef.get(PrismaService, { strict: false });
      void prisma.journalAudit
        .create({ data: { utilisateurId: user.id, action: 'ACCES_REFUSE', entite: 'Route', entiteId: 0, details: { methode: req.method, chemin, role: user.role } } })
        .catch((e: Error) => this.logger.error(`Journal ACCES_REFUSE impossible : ${e.message}`));
    } catch (e) {
      this.logger.error(`Journal ACCES_REFUSE impossible : ${(e as Error).message}`);
    }
  }
}
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleUtilisateur } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Principe du moindre privilège : vérifie que req.user.role fait partie des rôles
// autorisés par @Roles(...) sur la route. Se place APRÈS JwtAuthGuard
// (il faut req.user, donc l'authentification doit déjà avoir eu lieu).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleUtilisateur[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // route sans restriction de rôle particulière
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Vous n'avez pas les droits nécessaires pour cette action");
    }

    return true;
  }
}

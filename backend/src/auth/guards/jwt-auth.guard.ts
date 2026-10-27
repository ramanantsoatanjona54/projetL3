import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Tant que le mot de passe temporaire n'est pas changé ou que la 2FA admin n'est pas activée,
// seules ces routes répondent (appliqué par le serveur, pas seulement par l'interface)
const ROUTES_AUTORISEES = [
  '/auth/changer-mot-de-passe', '/auth/logout', '/notifications/non-lues',
  '/auth/2fa/etat', '/auth/2fa/preparer', '/auth/2fa/activer',
];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, _info: any, context: ExecutionContext): TUser {
    if (err || !user) throw err || new UnauthorizedException('Session expirée ou invalide');
    if (user.doitChangerMotDePasse || user.doitActiver2fa) {
      const chemin = String(context.switchToHttp().getRequest().originalUrl).split('?')[0];
      if (!ROUTES_AUTORISEES.some((r) => chemin.endsWith(r))) {
        throw new ForbiddenException(
          user.doitChangerMotDePasse ? 'Vous devez d’abord changer votre mot de passe.' : 'Vous devez d’abord activer la double authentification.',
        );
      }
    }
    return user;
  }
}
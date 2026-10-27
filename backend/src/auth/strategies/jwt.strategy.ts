import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { INACTIVITE_MIN } from '../session.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET manquant ou trop court (32 caractères minimum) dans .env');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  // Appelée à CHAQUE requête : session, compte actif et rôle sont relus en base
  async validate(payload: { sub: number; sid?: string }) {
    if (!payload.sid) throw new UnauthorizedException('Session invalide');
    const s = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: {
        id: true, utilisateurId: true, expiresAt: true, derniereActivite: true, revoquee: true,
        utilisateur: { select: { id: true, email: true, role: true, personnelId: true, parentId: true, actif: true, doitChangerMotDePasse: true, totpActif: true } },
      },
    });
    if (!s || s.revoquee || s.utilisateurId !== payload.sub || !s.utilisateur.actif) {
      throw new UnauthorizedException('Session expirée ou invalide');
    }

    const maintenant = Date.now();
    if (s.expiresAt.getTime() < maintenant || maintenant - s.derniereActivite.getTime() > INACTIVITE_MIN * 60_000) {
      await this.prisma.session.updateMany({ where: { id: s.id }, data: { revoquee: true } });
      throw new UnauthorizedException('Session expirée');
    }
    if (maintenant - s.derniereActivite.getTime() > 60_000) {
      await this.prisma.session.update({ where: { id: s.id }, data: { derniereActivite: new Date(maintenant) } });
    }

        const { actif, totpActif, ...utilisateur } = s.utilisateur;
    return { ...utilisateur, doitActiver2fa: utilisateur.role === 'ADMIN' && !totpActif, sessionId: s.id };
  }
}
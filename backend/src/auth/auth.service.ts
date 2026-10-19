import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;
const MAX_TENTATIVES = 5;
const DUREE_VERROUILLAGE_MIN = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existant = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
    if (existant) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const motDePasseHash = await bcrypt.hash(dto.motDePasse, BCRYPT_ROUNDS);

    return this.prisma.utilisateur.create({
      data: {
        email: dto.email,
        motDePasseHash,
        role: dto.role,
        personnelId: dto.personnelId,
        parentId: dto.parentId,
        doitChangerMotDePasse: true,
      },
      select: { id: true, email: true, role: true },
    });
  }

  async login(dto: LoginDto) {
    const utilisateur = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });

    // Message volontairement identique pour un email inexistant ou un mauvais mot de passe
    if (!utilisateur) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const maintenant = new Date();
    if (utilisateur.verrouilleJusqua && utilisateur.verrouilleJusqua > maintenant) {
      throw new UnauthorizedException(
        `Compte temporairement verrouillé suite à trop de tentatives. Réessayez après ${utilisateur.verrouilleJusqua.toLocaleTimeString('fr-FR')}`,
      );
    }

    const motDePasseValide = await bcrypt.compare(dto.motDePasse, utilisateur.motDePasseHash);

    if (!motDePasseValide) {
      // Si un verrouillage précédent est expiré, on repart de zéro
      const base =
        utilisateur.verrouilleJusqua && utilisateur.verrouilleJusqua <= maintenant
          ? 0
          : utilisateur.tentativesEchouees;
      const tentatives = base + 1;
      await this.prisma.utilisateur.update({
        where: { id: utilisateur.id },
        data: {
          tentativesEchouees: tentatives,
          verrouilleJusqua:
            tentatives >= MAX_TENTATIVES
              ? new Date(Date.now() + DUREE_VERROUILLAGE_MIN * 60_000)
              : null,
        },
      });
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Révélé seulement à qui connaît le bon mot de passe
    if (!utilisateur.actif) {
      throw new UnauthorizedException("Ce compte est désactivé. Contactez l'administration.");
    }

    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: { tentativesEchouees: 0, verrouilleJusqua: null, derniereConnexion: maintenant },
    });

    const payload = { sub: utilisateur.id, role: utilisateur.role };

    return {
      access_token: this.jwtService.sign(payload),
      utilisateur: {
        id: utilisateur.id,
        email: utilisateur.email,
        role: utilisateur.role,
        doitChangerMotDePasse: utilisateur.doitChangerMotDePasse,
      },
    };
  }

  async changerMotDePasse(utilisateurId: number, ancienMotDePasse: string, nouveauMotDePasse: string) {
    const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });

    const ok = await bcrypt.compare(ancienMotDePasse, utilisateur.motDePasseHash);
    if (!ok) {
      // 400 et non 401 : l'utilisateur est bien connecté, c'est sa saisie qui est fausse
      throw new BadRequestException('Ancien mot de passe incorrect');
    }
    if (ancienMotDePasse === nouveauMotDePasse) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien.");
    }

    const motDePasseHash = await bcrypt.hash(nouveauMotDePasse, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.utilisateur.update({
        where: { id: utilisateurId },
        data: { motDePasseHash, doitChangerMotDePasse: false },
      }),
      this.prisma.journalAudit.create({
        data: { utilisateurId, action: 'MOT_DE_PASSE_CHANGE', entite: 'Utilisateur', entiteId: utilisateurId },
      }),
    ]);

    return { message: 'Mot de passe mis à jour' };
  }
}
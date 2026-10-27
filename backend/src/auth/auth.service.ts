import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RoleUtilisateur, Utilisateur } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { Verifier2faDto } from './dto/deux-facteurs.dto';
import { DUREE_DEFI_MIN, DUREE_MAX_MIN, DUREE_VERROUILLAGE_MIN, MAX_TENTATIVES } from './session.constants';
import { chiffrer, dechiffrer, empreinte, genererCodesSecours, verifierCle } from './totp.util';

authenticator.options = { window: 1 }; // tolère 30 s de décalage d'horloge

const BCRYPT_ROUNDS = 12;
const FAUX_HASH = bcrypt.hashSync('mot-de-passe-factice', BCRYPT_ROUNDS);
const MSG_ECHEC = 'Email ou mot de passe incorrect, ou compte temporairement verrouillé.';
const MSG_ECHEC_2FA = 'Code incorrect ou expiré, ou compte temporairement verrouillé.';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {
    verifierCle(); // le serveur refuse de démarrer sans TOTP_CLE valide
  }

  private journaliser(utilisateurId: number, action: string, details?: Prisma.InputJsonValue, entiteId = utilisateurId) {
    return this.prisma.journalAudit.create({ data: { utilisateurId, action, entite: 'Utilisateur', entiteId, details } });
  }

  // ---------- Compteur d'essais commun (mot de passe ET code 2FA) ----------

  // Une tentative est RÉSERVÉE avant toute vérification : au plus MAX_TENTATIVES essais, même en parallèle
  private async reserverTentative(u: Pick<Utilisateur, 'id' | 'verrouilleJusqua'>, message: string): Promise<number> {
    if (u.verrouilleJusqua && u.verrouilleJusqua <= new Date()) {
      await this.prisma.utilisateur.update({ where: { id: u.id }, data: { tentativesEchouees: 0, verrouilleJusqua: null } });
    }
    const apres = await this.prisma.utilisateur.update({
      where: { id: u.id }, data: { tentativesEchouees: { increment: 1 } }, select: { tentativesEchouees: true },
    });
    if (apres.tentativesEchouees > MAX_TENTATIVES) {
      await this.verrouiller(u.id);
      await bcrypt.compare('x', FAUX_HASH);
      throw new UnauthorizedException(message);
    }
    return apres.tentativesEchouees;
  }

  private verrouiller(id: number) {
    return this.prisma.utilisateur.updateMany({
      where: { id, verrouilleJusqua: null },
      data: { verrouilleJusqua: new Date(Date.now() + DUREE_VERROUILLAGE_MIN * 60_000) },
    });
  }

    private async enregistrerEchec(id: number, tentatives: number, etape: string, ip?: string) {
    const verrouille = tentatives >= MAX_TENTATIVES;
    if (verrouille) await this.verrouiller(id);
    await this.journaliser(id, verrouille ? 'COMPTE_VERROUILLE' : etape, { tentatives, ip: ip ?? null });
  }

  // ---------- Connexion ----------

  async login(dto: LoginDto, contexte: { ip?: string; agent?: string }) {
    const u = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
    if (!u) {
      await bcrypt.compare(dto.motDePasse, FAUX_HASH);
      throw new UnauthorizedException(MSG_ECHEC);
    }
    const tentatives = await this.reserverTentative(u, MSG_ECHEC);

    const ok = await bcrypt.compare(dto.motDePasse, u.motDePasseHash);
    if (!ok) {
      await this.enregistrerEchec(u.id, tentatives, 'CONNEXION_ECHEC',contexte.ip);
      throw new UnauthorizedException(MSG_ECHEC);
    }
    if (!u.actif) {
      await this.journaliser(u.id, 'CONNEXION_REFUSEE_COMPTE_DESACTIVE');
      throw new UnauthorizedException("Ce compte est désactivé. Contactez l'administration.");
    }

    if (u.totpActif) {
      // Le compteur n'est PAS remis à zéro ici : seulement après le second facteur
      return {
        etape: '2fa' as const,
        jetonDefi: this.jwtService.sign({ sub: u.id, but: '2fa' }, { expiresIn: `${DUREE_DEFI_MIN}m` }),
      };
    }
    return this.ouvrirSession(u, contexte);
  }

  async verifier2fa(dto: Verifier2faDto, contexte: { ip?: string; agent?: string }) {
    let sub: number;
    try {
      const p = this.jwtService.verify<{ sub: number; but?: string }>(dto.jetonDefi);
      if (p.but !== '2fa') throw new Error();
      sub = p.sub;
    } catch {
      throw new UnauthorizedException('Étape expirée. Recommencez la connexion.');
    }
    const u = await this.prisma.utilisateur.findUnique({ where: { id: sub } });
    if (!u || !u.actif || !u.totpActif || !u.totpSecretChiffre) throw new UnauthorizedException('Étape invalide. Recommencez la connexion.');

    const tentatives = await this.reserverTentative(u, MSG_ECHEC_2FA);
    if (!(await this.verifierCode(u, dto.code))) {
      await this.enregistrerEchec(u.id, tentatives, 'CONNEXION_2FA_ECHEC',contexte.ip);
      throw new UnauthorizedException(MSG_ECHEC_2FA);
    }
    return this.ouvrirSession(u, contexte);
  }

  private async ouvrirSession(
    u: Pick<Utilisateur, 'id' | 'email' | 'role' | 'doitChangerMotDePasse' | 'totpActif'>,
    contexte: { ip?: string; agent?: string },
  ) {
    const maintenant = new Date();
    await this.prisma.utilisateur.update({
      where: { id: u.id }, data: { tentativesEchouees: 0, verrouilleJusqua: null, derniereConnexion: maintenant },
    });
    await this.prisma.session.deleteMany({ where: { utilisateurId: u.id, OR: [{ expiresAt: { lt: maintenant } }, { revoquee: true }] } });
    const session = await this.prisma.session.create({
      data: {
        utilisateurId: u.id, expiresAt: new Date(Date.now() + DUREE_MAX_MIN * 60_000),
        ip: contexte.ip?.slice(0, 45), agent: contexte.agent?.slice(0, 200),
      },
      select: { id: true },
    });
    await this.journaliser(u.id, 'CONNEXION_REUSSIE', { ip: contexte.ip ?? null });
    return {
      access_token: this.jwtService.sign({ sub: u.id, sid: session.id }, { expiresIn: `${DUREE_MAX_MIN}m` }),
      expireDans: DUREE_MAX_MIN * 60,
      utilisateur: {
        id: u.id, email: u.email, role: u.role, doitChangerMotDePasse: u.doitChangerMotDePasse,
        doitActiver2fa: u.role === RoleUtilisateur.ADMIN && !u.totpActif,
      },
    };
  }

  async logout(utilisateurId: number, sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, utilisateurId }, data: { revoquee: true } });
    await this.journaliser(utilisateurId, 'DECONNEXION');
    return { message: 'Déconnecté' };
  }

  async changerMotDePasse(utilisateurId: number, sessionId: string, ancien: string, nouveau: string) {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    if (!(await bcrypt.compare(ancien, u.motDePasseHash))) throw new BadRequestException('Ancien mot de passe incorrect');
    if (ancien === nouveau) throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien.");
    const motDePasseHash = await bcrypt.hash(nouveau, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.utilisateur.update({ where: { id: utilisateurId }, data: { motDePasseHash, doitChangerMotDePasse: false } }),
      this.prisma.session.updateMany({ where: { utilisateurId, revoquee: false, id: { not: sessionId } }, data: { revoquee: true } }),
      this.prisma.journalAudit.create({ data: { utilisateurId, action: 'MOT_DE_PASSE_CHANGE', entite: 'Utilisateur', entiteId: utilisateurId } }),
    ]);
    return { message: 'Mot de passe mis à jour' };
  }

  // ---------- Vérification des codes ----------

  // Code à 6 chiffres : valide une seule fois (le pas de 30 s accepté ne peut plus resservir)
  private async verifierTotp(u: Utilisateur, code: string): Promise<boolean> {
    if (!u.totpSecretChiffre || !/^\d{6}$/.test(code.trim())) return false;
    const delta = authenticator.checkDelta(code.trim(), dechiffrer(u.totpSecretChiffre));
    if (delta === null) return false;
    const pas = Math.floor(Date.now() / 30_000) + delta;
    const r = await this.prisma.utilisateur.updateMany({
      where: { id: u.id, OR: [{ totpDernierPas: null }, { totpDernierPas: { lt: pas } }] },
      data: { totpDernierPas: pas },
    });
    return r.count === 1;
  }

  // Code de secours : à usage unique, marqué utilisé de façon atomique
  private async verifierSecours(u: Utilisateur, code: string): Promise<boolean> {
    const r = await this.prisma.codeSecours.updateMany({
      where: { utilisateurId: u.id, empreinte: empreinte(code), utilise: false }, data: { utilise: true },
    });
    if (r.count === 1) await this.journaliser(u.id, 'CODE_SECOURS_UTILISE');
    return r.count === 1;
  }

  private async verifierCode(u: Utilisateur, code: string) {
    return (await this.verifierTotp(u, code)) || (await this.verifierSecours(u, code));
  }

  private async confirmer(u: Utilisateur, motDePasse: string, code: string) {
    if (!(await bcrypt.compare(motDePasse, u.motDePasseHash))) throw new BadRequestException('Mot de passe incorrect');
    if (!(await this.verifierCode(u, code))) throw new BadRequestException('Code incorrect ou déjà utilisé');
  }

  // ---------- Configuration de la 2FA ----------

  async etat2fa(utilisateurId: number) {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    const codesRestants = u.totpActif ? await this.prisma.codeSecours.count({ where: { utilisateurId, utilise: false } }) : 0;
    return { actif: u.totpActif, obligatoire: u.role === RoleUtilisateur.ADMIN, codesRestants };
  }

  async preparer2fa(utilisateurId: number) {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    if (u.totpActif) throw new ConflictException('La double authentification est déjà activée.');
    const secret = authenticator.generateSecret();
    await this.prisma.utilisateur.update({ where: { id: u.id }, data: { totpSecretChiffre: chiffrer(secret), totpDernierPas: null } });
    return { secret, otpauthUrl: authenticator.keyuri(u.email, 'Les Colibris', secret) };
  }

  async activer2fa(utilisateurId: number, sessionId: string, code: string) {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    if (u.totpActif) throw new ConflictException('La double authentification est déjà activée.');
    if (!u.totpSecretChiffre) throw new BadRequestException("Générez d'abord le code QR.");
    if (!(await this.verifierTotp(u, code))) {
      throw new BadRequestException("Code incorrect. Vérifiez l'heure de votre téléphone et réessayez.");
    }
    const codes = genererCodesSecours();
    await this.prisma.$transaction([
      this.prisma.codeSecours.deleteMany({ where: { utilisateurId } }),
      this.prisma.codeSecours.createMany({ data: codes.map((c) => ({ utilisateurId, empreinte: empreinte(c) })) }),
      this.prisma.utilisateur.update({ where: { id: utilisateurId }, data: { totpActif: true } }),
      this.prisma.session.updateMany({ where: { utilisateurId, revoquee: false, id: { not: sessionId } }, data: { revoquee: true } }),
      this.prisma.journalAudit.create({ data: { utilisateurId, action: 'DEUX_FACTEURS_ACTIVE', entite: 'Utilisateur', entiteId: utilisateurId } }),
    ]);
    return { codesSecours: codes }; // montrés UNE seule fois
  }

  async desactiver2fa(utilisateurId: number, sessionId: string, motDePasse: string, code: string) {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    if (u.role === RoleUtilisateur.ADMIN) throw new ForbiddenException('La double authentification est obligatoire pour les administrateurs.');
    if (!u.totpActif) throw new BadRequestException("La double authentification n'est pas activée.");
    await this.confirmer(u, motDePasse, code);
    await this.prisma.$transaction([
      this.prisma.utilisateur.update({ where: { id: utilisateurId }, data: { totpActif: false, totpSecretChiffre: null, totpDernierPas: null } }),
      this.prisma.codeSecours.deleteMany({ where: { utilisateurId } }),
      this.prisma.session.updateMany({ where: { utilisateurId, revoquee: false, id: { not: sessionId } }, data: { revoquee: true } }),
      this.prisma.journalAudit.create({ data: { utilisateurId, action: 'DEUX_FACTEURS_DESACTIVE', entite: 'Utilisateur', entiteId: utilisateurId } }),
    ]);
    return { message: 'Double authentification désactivée' };
  }

  async regenererCodes(utilisateurId: number, motDePasse: string, code: string) {
    const u = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurId } });
    if (!u.totpActif) throw new BadRequestException("La double authentification n'est pas activée.");
    await this.confirmer(u, motDePasse, code);
    const codes = genererCodesSecours();
    await this.prisma.$transaction([
      this.prisma.codeSecours.deleteMany({ where: { utilisateurId } }),
      this.prisma.codeSecours.createMany({ data: codes.map((c) => ({ utilisateurId, empreinte: empreinte(c) })) }),
      this.prisma.journalAudit.create({ data: { utilisateurId, action: 'CODES_SECOURS_REGENERES', entite: 'Utilisateur', entiteId: utilisateurId } }),
    ]);
    return { codesSecours: codes };
  }

  // Un administrateur débloque un collègue qui a perdu son téléphone ET ses codes (jamais lui-même)
  async reinitialiser2fa(adminId: number, cibleId: number) {
    if (adminId === cibleId) throw new ForbiddenException('Vous ne pouvez pas réinitialiser votre propre double authentification.');
    const cible = await this.prisma.utilisateur.findUnique({ where: { id: cibleId }, select: { id: true } });
    if (!cible) throw new NotFoundException('Utilisateur introuvable.');
    await this.prisma.$transaction([
      this.prisma.utilisateur.update({ where: { id: cibleId }, data: { totpActif: false, totpSecretChiffre: null, totpDernierPas: null } }),
      this.prisma.codeSecours.deleteMany({ where: { utilisateurId: cibleId } }),
      this.prisma.session.updateMany({ where: { utilisateurId: cibleId, revoquee: false }, data: { revoquee: true } }),
      this.prisma.journalAudit.create({
        data: { utilisateurId: adminId, action: 'DEUX_FACTEURS_REINITIALISE', entite: 'Utilisateur', entiteId: cibleId },
      }),
    ]);
    return { message: 'Double authentification réinitialisée. La personne devra la reconfigurer.' };
  }
}
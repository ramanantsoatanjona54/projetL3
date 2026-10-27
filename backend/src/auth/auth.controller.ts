import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleUtilisateur } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto';
import { CodeDto, ConfirmationDto, Verifier2faDto } from './dto/deux-facteurs.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

const LIMITE_LOGIN = { default: { limit: 30, ttl: 60_000 } };
const LIMITE_SENSIBLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private contexte(req: any) { return { ip: req.ip as string | undefined, agent: req.headers['user-agent'] as string | undefined }; }

  @Post('login') @Throttle(LIMITE_LOGIN)
  login(@Body() dto: LoginDto, @Req() req: any): Promise<unknown> { return this.authService.login(dto, this.contexte(req)); }

  @Post('login/2fa') @Throttle(LIMITE_LOGIN)
  login2fa(@Body() dto: Verifier2faDto, @Req() req: any): Promise<unknown> { return this.authService.verifier2fa(dto, this.contexte(req)); }

  @Post('logout') @UseGuards(JwtAuthGuard)
  logout(@Req() req: any) { return this.authService.logout(req.user.id, req.user.sessionId); }

  @Post('changer-mot-de-passe') @UseGuards(JwtAuthGuard) @Throttle(LIMITE_SENSIBLE)
  changerMotDePasse(@Req() req: any, @Body() dto: ChangerMotDePasseDto) {
    return this.authService.changerMotDePasse(req.user.id, req.user.sessionId, dto.ancienMotDePasse, dto.nouveauMotDePasse);
  }

  // ----- Double authentification -----

  @Get('2fa/etat') @UseGuards(JwtAuthGuard)
  etat(@Req() req: any) { return this.authService.etat2fa(req.user.id); }

  @Post('2fa/preparer') @UseGuards(JwtAuthGuard) @Throttle(LIMITE_SENSIBLE)
  preparer(@Req() req: any) { return this.authService.preparer2fa(req.user.id); }

  @Post('2fa/activer') @UseGuards(JwtAuthGuard) @Throttle(LIMITE_SENSIBLE)
  activer(@Req() req: any, @Body() dto: CodeDto) { return this.authService.activer2fa(req.user.id, req.user.sessionId, dto.code); }

  @Post('2fa/desactiver') @UseGuards(JwtAuthGuard) @Throttle(LIMITE_SENSIBLE)
  desactiver(@Req() req: any, @Body() dto: ConfirmationDto) {
    return this.authService.desactiver2fa(req.user.id, req.user.sessionId, dto.motDePasse, dto.code);
  }

  @Post('2fa/codes-secours') @UseGuards(JwtAuthGuard) @Throttle(LIMITE_SENSIBLE)
  codesSecours(@Req() req: any, @Body() dto: ConfirmationDto) { return this.authService.regenererCodes(req.user.id, dto.motDePasse, dto.code); }

  @Post('2fa/reinitialiser/:utilisateurId') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(RoleUtilisateur.ADMIN)
  reinitialiser(@Req() req: any, @Param('utilisateurId', ParseIntPipe) id: number) {
    return this.authService.reinitialiser2fa(req.user.id, id);
  }
}
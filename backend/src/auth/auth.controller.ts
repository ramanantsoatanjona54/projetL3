import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RoleUtilisateur } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Conservée pour l'amorçage. Pour créer les comptes du personnel, utilisez désormais
  // POST /utilisateurs (mot de passe temporaire généré par le serveur).
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleUtilisateur.ADMIN)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('changer-mot-de-passe')
  @UseGuards(JwtAuthGuard)
  changerMotDePasse(@Req() req: any, @Body() dto: ChangerMotDePasseDto) {
    return this.authService.changerMotDePasse(req.user.id, dto.ancienMotDePasse, dto.nouveauMotDePasse);
  }
}
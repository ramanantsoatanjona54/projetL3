import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Protège une route : exige un token JWT valide dans l'en-tête Authorization.
// Usage : @UseGuards(JwtAuthGuard) sur un contrôleur ou une méthode.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

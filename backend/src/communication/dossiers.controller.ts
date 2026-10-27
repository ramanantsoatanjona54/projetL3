import {
  Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Post, Query, Req, StreamableFile,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeposerDossierDto } from './dto/communication.dto';
import { DossiersService, TAILLE_MAX } from './dossiers.service';
import type { FichierEnvoye, FiltresDossiers } from './dossiers.service';

const { ADMIN, DIRECTRICE, SECRETARIAT, ENSEIGNANT, COMPTABLE } = RoleUtilisateur;

// Documents internes : jamais accessibles à un parent
@Controller('dossiers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN, DIRECTRICE, SECRETARIAT, ENSEIGNANT, COMPTABLE)
export class DossiersController {
  constructor(private readonly service: DossiersService) {}

  private acteur(req: any) { return { id: req.user.id as number, role: req.user.role as RoleUtilisateur }; }

  @Get()
  lister(@Query() q: FiltresDossiers, @Req() req: any) { return this.service.lister(this.acteur(req), q); }

  @Post()
  @Roles(ADMIN, DIRECTRICE, SECRETARIAT, ENSEIGNANT)
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX, files: 1 } }))
  deposer(@UploadedFile() fichier: FichierEnvoye, @Body() dto: DeposerDossierDto, @Req() req: any) {
    return this.service.deposer(fichier, dto, this.acteur(req));
  }

  @Get(':id/fichier')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  async telecharger(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const f = await this.service.ouvrir(id, this.acteur(req));
    const ascii = f.nom.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    return new StreamableFile(f.flux, {
      type: f.mime,
      length: f.taille,
      // toujours en pièce jointe : le navigateur n'exécute ni n'affiche le contenu
      disposition: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.nom)}`,
    });
  }

  @Delete(':id')
  @Roles(ADMIN, DIRECTRICE, SECRETARIAT, ENSEIGNANT)
  supprimer(@Param('id', ParseIntPipe) id: number, @Req() req: any) { return this.service.supprimer(id, this.acteur(req)); }
}
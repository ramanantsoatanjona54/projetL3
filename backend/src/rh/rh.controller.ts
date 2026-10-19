import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { RhService } from './rh.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleUtilisateur, TypeCertificat } from '@prisma/client';

@Controller('rh')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.COMPTABLE, RoleUtilisateur.DIRECTRICE)
export class RhController {
  constructor(private readonly rhService: RhService) {}

  @Get('personnel')
  listerPersonnel() {
    return this.rhService.listerPersonnel();
  }

  @Post('personnel')
  @Roles(RoleUtilisateur.ADMIN)
  creerPersonnel(@Body() dto: CreatePersonnelDto) {
    return this.rhService.creerPersonnel(dto);
  }

  @Post('pointages/:personnelId/arrivee')
  @Roles(RoleUtilisateur.ADMIN)
  enregistrerArrivee(@Param('personnelId', ParseIntPipe) personnelId: number) {
    return this.rhService.enregistrerArrivee(personnelId);
  }

  @Post('pointages/:pointageId/depart')
  @Roles(RoleUtilisateur.ADMIN)
  enregistrerDepart(@Param('pointageId', ParseIntPipe) pointageId: number) {
    return this.rhService.enregistrerDepart(pointageId);
  }

  @Get('pointages/:personnelId')
  listerPointages(@Param('personnelId', ParseIntPipe) personnelId: number) {
    return this.rhService.listerPointages(personnelId);
  }

  @Post('fiches-de-paie')
  @Roles(RoleUtilisateur.COMPTABLE, RoleUtilisateur.ADMIN)
  creerFicheDePaie(
    @Body()
    body: { personnelId: number; mois: number; annee: number; salaireBrut: number; deductions?: number },
  ) {
    return this.rhService.calculerSalaireNet(
      body.personnelId,
      body.mois,
      body.annee,
      body.salaireBrut,
      body.deductions,
    );
  }

  @Get('fiches-de-paie/:personnelId')
  listerFichesDePaie(@Param('personnelId', ParseIntPipe) personnelId: number) {
    return this.rhService.listerFichesDePaie(personnelId);
  }

  @Post('certificats')
  @Roles(RoleUtilisateur.COMPTABLE, RoleUtilisateur.ADMIN)
  genererCertificat(@Body() body: { personnelId: number; type: TypeCertificat; contenu: string }) {
    return this.rhService.genererCertificat(body.personnelId, body.type, body.contenu);
  }
}
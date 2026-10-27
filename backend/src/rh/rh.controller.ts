import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RhService } from './rh.service';
import { PointageService } from './pointage.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { UpdatePersonnelDto } from './dto/update-personnel.dto';
import { DepartPersonnelDto } from './dto/depart-personnel.dto';
import { AnnulerPointageDto, CorrigerPointageDto, CreerPointageManuelDto } from './dto/pointage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleUtilisateur, TypeCertificat } from '@prisma/client';
import { Audit } from '../audit/audit.decorator';

@Controller('rh')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.COMPTABLE, RoleUtilisateur.DIRECTRICE)
export class RhController {
  constructor(
    private readonly rhService: RhService,
    private readonly pointageService: PointageService,
  ) {}

  // --- Personnel ---

  @Get('postes')
  listerPostes() {
    return this.rhService.listerPostes();
  }

  @Get('personnel')
  listerPersonnel() {
    return this.rhService.listerPersonnel();
  }

  @Get('personnel/:id')
  obtenirPersonnel(@Param('id', ParseIntPipe) id: number) {
    return this.rhService.obtenirPersonnel(id);
  }

  @Post('personnel')
  @Roles(RoleUtilisateur.ADMIN)
  creerPersonnel(@Body() dto: CreatePersonnelDto, @Req() req: any) {
    return this.rhService.creerPersonnel(dto, req.user?.id);
  }

  @Patch('personnel/:id')
  @Roles(RoleUtilisateur.ADMIN)
  modifierPersonnel(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePersonnelDto, @Req() req: any) {
    return this.rhService.modifierPersonnel(id, dto, req.user?.id);
  }

  @Post('personnel/:id/depart')
  @Roles(RoleUtilisateur.ADMIN)
  enregistrerDepartPersonnel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DepartPersonnelDto,
    @Req() req: any,
  ) {
    return this.rhService.enregistrerDepartPersonnel(id, dto, req.user?.id);
  }

  // --- Pointage : consultation ---

  @Get('presences/jour')
  presencesDuJour(@Query('date') date?: string) {
    return this.pointageService.presencesDuJour(date);
  }

  @Get('presences/mois')
  recapMensuel(@Query('mois') mois?: string) {
    return this.pointageService.recapMensuel(mois);
  }

  @Get('pointages/:personnelId')
  listerPointages(@Param('personnelId', ParseIntPipe) personnelId: number) {
    return this.pointageService.listerPointages(personnelId);
  }

  // --- Pointage : écriture (ADMIN seul) ---

  @Post('pointages/manuel')
  @Roles(RoleUtilisateur.ADMIN)
  creerManuel(@Body() dto: CreerPointageManuelDto, @Req() req: any) {
    return this.pointageService.creerManuel(dto, req.user?.id);
  }

  @Post('pointages/:personnelId/arrivee')
  @Roles(RoleUtilisateur.ADMIN)
  enregistrerArrivee(@Param('personnelId', ParseIntPipe) personnelId: number) {
    return this.pointageService.enregistrerArrivee(personnelId);
  }

  @Post('pointages/:pointageId/depart')
  @Roles(RoleUtilisateur.ADMIN)
  enregistrerDepart(@Param('pointageId', ParseIntPipe) pointageId: number) {
    return this.pointageService.enregistrerDepart(pointageId);
  }

  @Patch('pointages/:id/corriger')
  @Roles(RoleUtilisateur.ADMIN)
  corriger(@Param('id', ParseIntPipe) id: number, @Body() dto: CorrigerPointageDto, @Req() req: any) {
    return this.pointageService.corriger(id, dto, req.user?.id);
  }

  @Post('pointages/:id/annuler')
  @Roles(RoleUtilisateur.ADMIN)
  annuler(@Param('id', ParseIntPipe) id: number, @Body() dto: AnnulerPointageDto, @Req() req: any) {
    return this.pointageService.annuler(id, dto, req.user?.id);
  }

  // --- Certificats / contrats (inchangé) ---

  @Post('certificats')
  @Roles(RoleUtilisateur.COMPTABLE, RoleUtilisateur.ADMIN)
  @Audit('CERTIFICAT_GENERE', 'Certificat')
  genererCertificat(@Body() body: { personnelId: number; type: TypeCertificat; contenu: string }) {
    return this.rhService.genererCertificat(body.personnelId, body.type, body.contenu);
  }
}
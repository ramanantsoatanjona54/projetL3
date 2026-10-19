import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { AnnulerPaiementDto } from './dto/annuler-paiement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleUtilisateur } from '@prisma/client';
import { UpdateFraisDto } from './dto/update-frais.dto';
import { UpdateRemiseFraterniteDto } from './dto/update-remise-fraternite.dto';

const { ADMIN, COMPTABLE, DIRECTRICE, SECRETARIAT, PARENT } = RoleUtilisateur;

@Controller('finances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  // ---- Barème ----
  @Get('frais')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE)
  listerFrais() { return this.financesService.listerFrais(); }

  @Patch('frais/:id')
  @Roles(ADMIN)
  modifierFrais(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFraisDto, @Req() req: any) {
    return this.financesService.modifierFrais(id, dto, req.user?.id);
  }

  @Get('remises-fraternite')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE)
  listerRemises() { return this.financesService.listerRemisesFraternite(); }

  @Patch('remises-fraternite/:id')
  @Roles(ADMIN)
  modifierRemise(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRemiseFraterniteDto,
    @Req() req: any,
  ) {
    return this.financesService.modifierRemiseFraternite(id, dto, req.user?.id);
  }

  @Get('bareme/impact')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE)
  impactBareme() { return this.financesService.impactBareme(); }

  @Get('montant-ecolage/:rangEnfant')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE, SECRETARIAT)
  montantEcolage(@Param('rangEnfant', ParseIntPipe) rangEnfant: number) {
    return this.financesService.calculerMontantEcolage(rangEnfant);
  }

  // ---- Retards ----
  @Get('retards')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE)
  retards() { return this.financesService.retards(); }

  // ---- Situation et paiements d'une inscription (un parent ne voit que ses enfants) ----
  @Get('inscriptions/:inscriptionId/situation')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE, PARENT)
  async situation(@Param('inscriptionId', ParseIntPipe) inscriptionId: number, @Req() req: any) {
    if (req.user.role === PARENT) await this.financesService.verifierAccesParent(inscriptionId, req.user.id);
    return this.financesService.situation(inscriptionId);
  }

  @Get('inscriptions/:inscriptionId/paiements')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE, PARENT)
  async listerPaiements(@Param('inscriptionId', ParseIntPipe) inscriptionId: number, @Req() req: any) {
    if (req.user.role === PARENT) await this.financesService.verifierAccesParent(inscriptionId, req.user.id);
    return this.financesService.listerPaiements(inscriptionId);
  }

  @Get('inscriptions/:inscriptionId/statut/:mois')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE, SECRETARIAT, PARENT)
  async statutPaiement(
    @Param('inscriptionId', ParseIntPipe) inscriptionId: number,
    @Param('mois', ParseIntPipe) mois: number,
    @Req() req: any,
  ) {
    if (req.user.role === PARENT) await this.financesService.verifierAccesParent(inscriptionId, req.user.id);
    return this.financesService.verifierStatutPaiement(inscriptionId, mois);
  }

  // ---- Encaissement, annulation, reçu ----
  @Post('paiements')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE)
  creerPaiement(@Body() dto: CreatePaiementDto, @Req() req: any) {
    return this.financesService.creerPaiement(dto, req.user?.id);
  }

  @Patch('paiements/:id/annuler')
  @Roles(ADMIN, COMPTABLE)
  annuler(@Param('id', ParseIntPipe) id: number, @Body() dto: AnnulerPaiementDto, @Req() req: any) {
    return this.financesService.annulerPaiement(id, dto.motif, req.user?.id);
  }

  @Get('paiements/:id/recu')
  @Roles(ADMIN, COMPTABLE, DIRECTRICE, PARENT)
  async recu(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const recu = await this.financesService.recu(id);
    if (req.user.role === PARENT) await this.financesService.verifierAccesParent(recu.inscriptionId, req.user.id);
    return recu;
  }
}
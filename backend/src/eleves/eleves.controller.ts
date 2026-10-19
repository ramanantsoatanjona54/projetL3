import { Body, Controller, Get, Param, ParseIntPipe, Post, Patch , Req, UseGuards } from '@nestjs/common';
import { ElevesService } from './eleves.service';
import { CreateEleveDto } from './dto/create-eleve.dto';
import { AjouterParentDto } from './dto/ajouter-parent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleUtilisateur } from '@prisma/client';
import { UpdateEleveDto } from './dto/update-eleve.dto';

@Controller('eleves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ElevesController {
  constructor(private readonly service: ElevesService) {}

  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.SECRETARIAT)
  creerEleve(@Body() dto: CreateEleveDto) {
    return this.service.creerEleve(dto);
  }

  @Get()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.SECRETARIAT, RoleUtilisateur.DIRECTRICE)
  listerEleves() {
    return this.service.listerEleves();
  }

  @Get(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.SECRETARIAT, RoleUtilisateur.DIRECTRICE)
  rechercherEleve(@Param('id', ParseIntPipe) id: number) {
    return this.service.rechercherEleve(id);
  }

  @Post(':id/parents')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.SECRETARIAT)
  ajouterParent(@Param('id', ParseIntPipe) id: number, @Body() dto: AjouterParentDto) {
    return this.service.ajouterParent(id, dto);
  }
    @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.SECRETARIAT)
  modifier(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEleveDto, @Req() req: any) {
    return this.service.modifierEleve(id, dto, req.user?.id);
  }
}

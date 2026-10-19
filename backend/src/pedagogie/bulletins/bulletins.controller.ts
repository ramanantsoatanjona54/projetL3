import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BulletinsService } from './bulletins.service';
import { GenererBulletinDto } from './dto/generer-bulletin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pedagogie/bulletins')
export class BulletinsController {
  constructor(private readonly bulletinsService: BulletinsService) {}

  @Roles('ADMIN', 'ENSEIGNANT', 'DIRECTRICE')
  @Post('generer')
  genererBulletin(@Body() dto: GenererBulletinDto) {
    return this.bulletinsService.genererBulletin(dto);
  }

  @Get('inscriptions/:inscriptionId')
  getBulletins(@Param('inscriptionId', ParseIntPipe) inscriptionId: number) {
    return this.bulletinsService.getBulletinsInscription(inscriptionId);
  }
}

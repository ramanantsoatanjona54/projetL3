import { Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

// Tout utilisateur connecté, mais uniquement SES notifications (identité prise dans le jeton)
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  mesNotifications(@Req() req: any) {
    return this.service.mesNotifications(req.user.id);
  }

  @Get('non-lues')
  nonLues(@Req() req: any) {
    return this.service.nonLues(req.user.id);
  }

  @Patch('tout-lire')
  toutLire(@Req() req: any) {
    return this.service.toutLire(req.user.id);
  }

  @Patch(':id/lu')
  marquerLue(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.marquerLue(id, req.user.id);
  }
}
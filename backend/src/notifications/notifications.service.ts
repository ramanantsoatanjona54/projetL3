import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async mesNotifications(utilisateurId: number) {
    const [liste, nonLues] = await Promise.all([
      this.prisma.notification.findMany({ where: { utilisateurId }, orderBy: { id: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { utilisateurId, lu: false } }),
    ]);
    return {
      nonLues,
      notifications: liste.map((n) => ({ id: n.id, message: n.message, lu: n.lu, date: n.dateCreation })),
    };
  }

  async nonLues(utilisateurId: number) {
    return { nombre: await this.prisma.notification.count({ where: { utilisateurId, lu: false } }) };
  }

  // Le filtre sur utilisateurId empêche de toucher la notification de quelqu'un d'autre
  async marquerLue(id: number, utilisateurId: number) {
    const r = await this.prisma.notification.updateMany({ where: { id, utilisateurId }, data: { lu: true } });
    if (r.count === 0) throw new NotFoundException('Notification introuvable');
    return { message: 'Notification lue' };
  }

  async toutLire(utilisateurId: number) {
    const r = await this.prisma.notification.updateMany({ where: { utilisateurId, lu: false }, data: { lu: true } });
    return { marquees: r.count };
  }
}
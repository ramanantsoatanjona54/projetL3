import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// La fiche parent est TOUJOURS déduite du compte connecté, jamais d'une valeur envoyée par l'écran
export async function parentIdDe(prisma: PrismaService, utilisateurId: number): Promise<number> {
  const u = await prisma.utilisateur.findUnique({ where: { id: utilisateurId }, select: { parentId: true } });
  if (!u?.parentId) throw new ForbiddenException("Ce compte n'est lié à aucune fiche parent.");
  return u.parentId;
}
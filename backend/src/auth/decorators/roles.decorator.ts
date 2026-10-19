import { SetMetadata } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Usage sur une route : @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
export const Roles = (...roles: RoleUtilisateur[]) => SetMetadata(ROLES_KEY, roles);

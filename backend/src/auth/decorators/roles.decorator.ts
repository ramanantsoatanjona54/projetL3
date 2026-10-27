import { SetMetadata } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const TOUS_ROLES_KEY = 'tousRoles';

// Usage : @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTRICE)
export const Roles = (...roles: RoleUtilisateur[]) => SetMetadata(ROLES_KEY, roles);

// Choix EXPLICITE : tout utilisateur connecté peut appeler cette route (sans ce marqueur, une route sans @Roles est refusée)
export const TousRoles = () => SetMetadata(TOUS_ROLES_KEY, true);
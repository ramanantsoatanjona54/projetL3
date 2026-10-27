import { applyDecorators, CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, SetMetadata, UseInterceptors } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

const AUDIT_KEY = 'auditMeta';
type Meta = { action: string; entite: string };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');
  constructor(private readonly reflector: Reflector, private readonly moduleRef: ModuleRef) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<Meta>(AUDIT_KEY, context.getHandler());
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap((resultat: unknown) => {
        if (meta && req.user?.id) void this.ecrire(meta, req, resultat); // en arrière-plan : ne bloque ni ne fait échouer la réponse
      }),
    );
  }

  private async ecrire(meta: Meta, req: any, resultat: unknown): Promise<void> {
    try {
      const idRoute = Number(req.params?.id);
      const idCree = Number((resultat as { id?: unknown } | null)?.id);
      const entiteId = Number.isInteger(idRoute) && idRoute > 0 ? idRoute : Number.isInteger(idCree) && idCree > 0 ? idCree : 0;

      let details: Prisma.InputJsonValue | undefined;
      const corps = req.body;
      if (corps && typeof corps === 'object' && Object.keys(corps).length > 0) {
        const texte = JSON.stringify(corps);
        details = texte.length <= 2000 ? { donnees: JSON.parse(texte) } : { champs: Object.keys(corps) };
      }
      const prisma = this.moduleRef.get(PrismaService, { strict: false });
      await prisma.journalAudit.create({
        data: { utilisateurId: req.user.id, action: meta.action, entite: meta.entite, entiteId, details },
      });
    } catch (e) {
      this.logger.error(`Écriture du journal impossible (${meta.action}) : ${(e as Error).message}`);
    }
  }
}

// Usage : @Audit('CLASSE_CREEE', 'Classe') au-dessus d'une route d'écriture
export const Audit = (action: string, entite: string) =>
  applyDecorators(SetMetadata(AUDIT_KEY, { action, entite }), UseInterceptors(AuditInterceptor));
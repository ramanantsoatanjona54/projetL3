import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

// Le compteur est tenu par SESSION (jeton) et non par adresse : une école entière partage souvent une seule adresse.
// Sans jeton (connexion), on retombe sur l'adresse du client.
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const auth = req.headers?.authorization as string | undefined;
    if (auth) return 'session:' + createHash('sha256').update(auth).digest('hex').slice(0, 24);
    return req.ip;
  }
}
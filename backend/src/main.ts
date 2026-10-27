import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Un seul relais de confiance devant l'API (Next.js ou Nginx) : req.ip = adresse réelle du client
  app.set('trust proxy', 1);
  app.use(helmet());
  app.useBodyParser('json', { limit: '1mb' }); // les dépôts de fichiers passent par une route Next.js dédiée, pas par ce corps JSON

  // Pas de CORS : l'API n'est appelée que par le serveur Next.js, jamais directement par un navigateur.

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api');

  // Écoute sur la machine locale par défaut (HOST=0.0.0.0 seulement dans un conteneur Docker)
  await app.listen(Number(process.env.PORT ?? 3001), process.env.API_HOTE ?? '127.0.0.1');
}
bootstrap();
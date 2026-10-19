import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet()); // en-têtes de sécurité (CSP, X-Frame-Options, etc.)

  app.enableCors({
    origin: process.env.FRONTEND_URL, // ex. http://localhost:3000 en dev
    credentials: true,
  });

  // Validation systématique des DTO entrants (jamais confiance au seul frontend)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // rejette les champs non déclarés dans le DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

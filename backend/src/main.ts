import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — фронтенд (Next.js) ходит с другого origin.
  // CORS_ORIGIN (через запятую) ограничивает источники в проде, напр. домен
  // Vercel. Если не задан — разрешаем любой origin (удобно локально).
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : true;
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    // x-groq-key — заголовок BYOK с пользовательским ключом Groq.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-groq-key'],
  });

  // Валидация всех входящих DTO через class-validator.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://0.0.0.0:${port}`);
}
bootstrap();

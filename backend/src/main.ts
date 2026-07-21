import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — the frontend (Next.js) calls from a different origin.
  // CORS_ORIGIN (comma-separated) restricts origins in production, e.g. the
  // Vercel domain. If unset — any origin is allowed (handy locally).
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : true;
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    // x-groq-key — the BYOK header carrying the user's Groq key.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-groq-key'],
  });

  // Validation of every incoming DTO via class-validator.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://0.0.0.0:${port}`);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Run onModuleDestroy/onApplicationShutdown on SIGTERM/SIGINT so Prisma
  // and Redis disconnect cleanly and background loops stop (docker stop).
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  // Comma-separated so a dev can browse via both localhost and a LAN/VPN IP
  // (e.g. "http://localhost:3000,http://198.18.9.78:3000") without the
  // browser rejecting cross-origin cookies.
  const splitOrigins = (value: string | undefined, fallback: string) =>
    (value || fallback)
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);

  // Two allowlists, one CORS config: the player frontend and the separate
  // admin console (admin/, port 3001 by default). Both need credentials for
  // the httpOnly auth cookies, which is exactly why `origin: '*'` is never an
  // option here.
  const allowedOrigins = [
    ...splitOrigins(
      configService.get<string>('FRONTEND_URL'),
      'http://localhost:3000',
    ),
    ...splitOrigins(
      configService.get<string>('ADMIN_FRONTEND_URL'),
      'http://localhost:3001,http://localhost:7662',
    ),
  ];
  const frontendUrls = [...new Set(allowedOrigins)];
  const port =
    configService.get<number>('PORT') || Number(process.env.PORT) || 4000;

  // Number of reverse proxy hops (Cloudflare/Nginx/etc.) in front of this
  // server. Only trusted so req.ip/X-Forwarded-For resolve correctly behind
  // a known proxy chain - left at 0 (untrusted) by default.
  const trustProxyHops = configService.get<number>('TRUST_PROXY_HOPS') ?? 0;
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  app.use(cookieParser());

  // Challenge authoring (create, save, import, AI save) posts whole
  // challenges, which may carry up to MAX_TEST_CASES test cases of up to
  // MAX_TEST_CASE_JSON_BYTES each - far beyond the 100kb every other endpoint
  // gets. Mounted BEFORE the global parser so it is the one that runs for
  // these paths (staff-only routes). Imports are still capped at
  // MAX_IMPORT_BYTES by ChallengeImportService's friendlier check.
  app.use('/api/admin/challenges', json({ limit: '8mb' }));
  // Run/Submit accept up to MAX_SOURCE_CODE_LENGTH (64K) characters of code,
  // which JSON-encodes to well over 100kb when it contains quotes, newlines
  // or non-ASCII text.
  app.use('/api/matches', json({ limit: '512kb' }));

  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  // In development, VPN/LAN IPs can change frequently, so reflect whatever
  // origin the browser sends instead of maintaining an allowlist. Production
  // still enforces the FRONTEND_URL allowlist.
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  app.enableCors({
    origin: isProduction ? frontendUrls : true,
    credentials: true,
  });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CodeClash API')
    .setDescription('CodeClash backend API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  console.log(`Server running on http://localhost:${port}/api`);
}

bootstrap();

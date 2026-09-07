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

  const configService = app.get(ConfigService);
  // Comma-separated so a dev can browse via both localhost and a LAN/VPN IP
  // (e.g. "http://localhost:3000,http://198.18.9.78:3000") without the
  // browser rejecting cross-origin cookies.
  const frontendUrls = (
    configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
  )
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
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
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  app.enableCors({ origin: frontendUrls, credentials: true });
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

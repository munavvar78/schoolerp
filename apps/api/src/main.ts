import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { appConfig } from './config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false, rawBody: true });
  app.use(cookieParser());
  app.enableCors({
    origin: appConfig.webOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  await app.listen(appConfig.port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${appConfig.port}/api`);
}

bootstrap();

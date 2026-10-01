import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { SESSION_COOKIE } from './auth/auth.constants';
import { AppModule } from './app.module';
import { EnvironmentVariables, corsOrigins } from './config/env.validation';
import { AppExceptionFilter } from './filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // Required by the repo's nested query-param convention
  // (`?pagination[page]=2&sort[sortOrder]=ASC`, src/common/dtos/pagination.dto.ts).
  // Express 5 defaults to the 'simple' parser, which leaves `pagination[page]`
  // as a flat key — with forbidNonWhitelisted on, every such request is a 400.
  app.set('query parser', 'extended');

  app.enableCors({
    origin: corsOrigins(config.get('CORS_ORIGINS', { infer: true })),
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Clarivo API')
        .setVersion('0.0.1')
        .addCookieAuth(SESSION_COOKIE)
        .build(),
      { autoTagControllers: true },
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();

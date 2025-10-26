/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { Request, Response, NextFunction } from 'express';
import { TypedConfigService } from './app/lib/config';

const DOCS_PATH = 'docs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get<TypedConfigService>(ConfigService);

  const trustProxy = configService.getOrThrow<boolean>('APP_TRUST_PROXY');
  app.set('trust proxy', trustProxy ? 1 : 0);
  app.disable('x-powered-by');

  // Swagger UI does not handle path ending with / very well.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url === `/${DOCS_PATH}/`) {
      res.redirect(301, `/${DOCS_PATH}`);
    }
    if (req.url.startsWith(`/${DOCS_PATH}`)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    next();
  });

  const config = new DocumentBuilder().setTitle('Nano IoT API').build();
  const openApiDoc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, cleanupOpenApiDoc(openApiDoc));

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);

  Logger.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap();

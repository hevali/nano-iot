import { ConsoleLogger, LOG_LEVELS, Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import * as http from 'http';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import * as path from 'path';
import type { FileStore } from 'session-file-store';

import { enableA2A } from './app/agent/a2a';
import { AppModule } from './app/app.module';
import { ShutdownObserver } from './app/lib';
import { TypedConfigService } from './app/lib/config';

const FileStore: FileStore = require('session-file-store')(session);

const DOCS_PATH = 'docs';

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
  );
  app.enableShutdownHooks();

  const configService = app.get<TypedConfigService>(ConfigService);
  const port = configService.getOrThrow<number>('APP_PORT');
  const estPort = configService.getOrThrow<number>('APP_EST_PORT');

  server.use((req: Request, res: Response, next: NextFunction) => {
    req.headers['x-forwarded-host'] ??= req.headers.host;
    if (req.socket.localPort === estPort) {
      req.headers.host = 'est';
    }

    next();
  });

  const logLevel = configService.getOrThrow<LogLevel>('LOG_LEVEL');
  const logger = new ConsoleLogger({ logLevels: LOG_LEVELS.slice(LOG_LEVELS.indexOf(logLevel)) });
  app.useLogger(logger);

  const trustProxy = configService.getOrThrow<boolean>('APP_TRUST_PROXY');
  app.set('trust proxy', trustProxy ? 1 : 0);
  app.disable('x-powered-by');

  // Swagger UI does not handle path ending with / very well.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url === `/${DOCS_PATH}/`) {
      res.redirect(301, `/${DOCS_PATH}`);
    }
    next();
  });

  const basePath = configService.get<string>('APP_BASE_PATH');

  let doc = new DocumentBuilder().setTitle('Nano IoT API').addCookieAuth('connect.sid');
  if (basePath) {
    doc = doc.addServer(basePath);
  }

  const openApiDoc = SwaggerModule.createDocument(app, doc.build());
  SwaggerModule.setup(DOCS_PATH, app, cleanupOpenApiDoc(openApiDoc));

  const sessionStorePath = path.join(configService.getOrThrow<string>('APP_DATA_DIR'), 'sessions');
  const sessionSecret = configService.getOrThrow<string>('APP_SESSION_SECRET');
  const sessionMiddleware = session({
    store: new FileStore({
      path: sessionStorePath,
      reapAsync: true,
      logFn: () => {
        // empty
      },
    }),
    secret: sessionSecret,
    cookie: {
      secure: 'auto',
      httpOnly: true,
      sameSite: 'strict',
    },
    resave: false,
    saveUninitialized: false,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.socket.localPort !== estPort) {
      sessionMiddleware(req, res, next);
    } else {
      next();
    }
  });

  enableA2A(app);

  await app.init();

  const shutdownObserver = app.get(ShutdownObserver);

  const httpServer = await new Promise<http.Server>((res) => {
    const s = http.createServer(server).listen(port, () => res(s));
  });
  const estServer = await new Promise<http.Server>((res) => {
    const s = http.createServer(server).listen(estPort, () => res(s));
  });

  shutdownObserver.addHttpServer(httpServer);
  shutdownObserver.addHttpServer(estServer);

  Logger.log(`API server is running on: http://localhost:${port}`);
  Logger.log(`EST server is running on: http://localhost:${estPort}`);
}

bootstrap();

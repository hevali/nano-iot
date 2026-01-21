import {
  LOG_LEVELS,
  LogLevel,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MqttModule } from './mqtt/mqtt.module';
import { DeviceModule } from './device/device.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import {
  AddConfigurationAndTagsMigration1767285324438,
  ChatEntityMigration1761017774353,
  DeviceEntityMigration1760757514001,
  DeviceMethodEntityMigration1760757514002,
} from './migrations';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AnyExceptionFilter, ZodErrorFilter, TypeormErrorFilter } from './lib/filters';
import { CONFIG_SCHEMA, TypedConfigService } from './lib/config';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AgentModule } from './agent/agent.module';
import { AuthMiddleware, AuthModule } from './auth';
import { BasicAuthGuard } from './lib/guards';
import { McpModule, McpOptions } from '@rekog/mcp-nest';
import { McpController } from './lib/mcp';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const validated = CONFIG_SCHEMA.parse(config);
        return validated;
      },
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: TypedConfigService) => {
        return {
          type: 'sqlite',
          database: path.join(config.getOrThrow<string>('APP_DATA_DIR'), 'nano-iot.db'),
          busyErrorRetry: 3,
          namingStrategy: new SnakeNamingStrategy(),
          autoLoadEntities: true,
          synchronize: false,
          migrations: [
            DeviceEntityMigration1760757514001,
            DeviceMethodEntityMigration1760757514002,
            ChatEntityMigration1761017774353,
            AddConfigurationAndTagsMigration1767285324438,
          ],
          migrationsRun: true,
          migrationsTableName: '_migrations',
          migrationsTransactionMode: 'each',
        };
      },
      inject: [ConfigService],
    }),
    McpModule.forRootAsync({
      useFactory: (config: TypedConfigService) => {
        const logLevel = config.getOrThrow<LogLevel>('LOG_LEVEL');
        const level = logLevel === 'fatal' ? 'error' : logLevel;

        return {
          name: 'nano-iot-mcp-server',
          version: '0.0.1',
          instructions:
            'Nano IoT MCP Server.\n\nUse this MCP server to manage your devices remotely.',
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
          },
          // Index 5 = fatal which is not supported by this library.
          logging: {
            level: LOG_LEVELS.slice(LOG_LEVELS.indexOf(level), 5),
          } as McpOptions['logging'],
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    MqttModule,
    DeviceModule,
    AgentModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AnyExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ZodErrorFilter,
    },
    {
      provide: APP_FILTER,
      useClass: TypeormErrorFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    BasicAuthGuard,
  ],
  controllers: [McpController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: '/auth/login', method: RequestMethod.GET },
        { path: '/auth/login', method: RequestMethod.POST },
        { path: '/auth/logout', method: RequestMethod.GET },
        { path: '/mcp', method: RequestMethod.ALL },
        { path: '/a2a/*path', method: RequestMethod.ALL },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

import { LOG_LEVELS, LogLevel, Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { DeviceEntity, DeviceMethodEntity } from './device.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceMcp } from './device.mcp';
import { McpModule, McpOptions } from '@rekog/mcp-nest';
import { TypedConfigService } from '../lib/config';
import { BasicAuthGuard } from '../lib/guards';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceEntity, DeviceMethodEntity]),
    McpModule.forRootAsync({
      useFactory: (config: TypedConfigService) => {
        const logLevel = config.getOrThrow<LogLevel>('LOG_LEVEL');
        const level = logLevel === 'fatal' ? 'error' : logLevel;

        return {
          name: 'nano-iot-mcp-server',
          version: '0.0.1',
          instructions:
            'Nano IoT MCP Server.\n\nUse this MCP server to manage your devices remotely.',
          guards: [BasicAuthGuard],
          capabilities: {
            tools: { listChanged: false },
            resources: { listChanged: false },
          },
          // Index 5 = fatal which is not supported by this libary.
          logging: {
            level: LOG_LEVELS.slice(LOG_LEVELS.indexOf(level), 5),
          } as McpOptions['logging'],
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [DeviceService, DeviceMcp],
  exports: [DeviceService],
  controllers: [DeviceController],
})
export class DeviceModule {}

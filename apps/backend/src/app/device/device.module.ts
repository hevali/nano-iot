import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpModule } from '@rekog/mcp-nest';

import { DeviceController } from './device.controller';
import { DeviceEntity, DeviceMethodEntity } from './device.entity';
import { DeviceMcp } from './device.mcp';
import { DeviceService } from './device.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceEntity, DeviceMethodEntity]),
    McpModule.forFeature([DeviceService, DeviceMcp], 'nano-iot-mcp-server'),
  ],
  providers: [DeviceService, DeviceMcp],
  exports: [DeviceService],
  controllers: [DeviceController],
})
export class DeviceModule {}

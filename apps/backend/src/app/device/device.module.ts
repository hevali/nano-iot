import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { DeviceEntity, DeviceMethodEntity } from './device.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceMcp } from './device.mcp';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceEntity, DeviceMethodEntity])],
  providers: [DeviceService, DeviceMcp],
  exports: [DeviceService],
  controllers: [DeviceController],
})
export class DeviceModule {}

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { DeviceService } from './device.service';
import { ApiBody, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateDeviceDto,
  DeviceDto,
  DevicePropetiesSchema,
  DeviceWithCredentialsDto,
} from './device.dto';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';
import { JsonMqttPayload, JsonMqttSubscribe, JsonMqttTopic } from '../mqtt/rpc.decorator';

@Controller('devices')
@ApiTags('Devices')
export class DeviceController {
  constructor(private deviceService: DeviceService) {}

  @Get()
  @ZodResponse({ type: [DeviceDto] })
  async getDevices() {
    return this.deviceService.getDevices();
  }

  @Get(':id')
  @ZodResponse({ type: DeviceDto })
  async getDevice(@Param('id') id: string) {
    return this.deviceService.getDevice(id);
  }

  @Post()
  @ZodResponse({ type: DeviceWithCredentialsDto, status: 201 })
  async createDevice(@Body() dto: CreateDeviceDto) {
    return this.deviceService.createDevice(dto.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  async deleteDevice(@Param('id') id: string) {
    await this.deviceService.deleteDevice(id);
  }

  @Get(':id/properties')
  async getDeviceProperties(@Param('id') id: string) {
    const device = await this.deviceService.getDevice(id);
    return device.properties;
  }

  @Put(':id/properties')
  @ApiBody({ type: Object })
  async updateDeviceProperties(@Param('id') id: string, @Body() properties: Record<string, any>) {
    const device = await this.deviceService.setDeviceProperties(id, properties);
    return device.properties;
  }

  @JsonMqttSubscribe('iot/devices/+/properties/reported')
  async onDeviceProperties(
    @JsonMqttTopic() topic: string,
    @JsonMqttPayload(new ZodValidationPipe(DevicePropetiesSchema)) properties: Record<string, any>
  ) {
    const id = topic.split('/')[2];
    await this.deviceService.reportDeviceProperties(id, properties);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { DeviceService } from './device.service';
import { ApiBody, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateDeviceDtoSchema,
  DeviceMethodSchema,
  DevicePropertiesDtoSchema,
  DeviceWithCredentialsDtoSchema,
} from '@nano-iot/common';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';
import { JsonMqttPayload, JsonMqttSubscribe, JsonMqttTopic } from '../mqtt/rpc.decorator';
import { CreateDeviceDto, DeviceDto, DeviceMethodDto, DeviceWithCredentialsDto } from '../models';
import { Tool } from '@rekog/mcp-nest';

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
    return this.deviceService.createDevice(dto);
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
  async updateDeviceProperties(
    @Param('id') id: string,
    @Body() properties: Record<string, unknown>
  ) {
    const device = await this.deviceService.setDeviceProperties({ deviceId: id, properties });
    return device.properties;
  }

  @JsonMqttSubscribe('iot/devices/+/properties/reported')
  async onDeviceProperties(
    @JsonMqttTopic() topic: string,
    @JsonMqttPayload(new ZodValidationPipe(DevicePropertiesDtoSchema))
    properties: Record<string, unknown>
  ) {
    const id = topic.split('/')[2];
    await this.deviceService.reportDeviceProperties(id, properties);
  }

  @JsonMqttSubscribe('iot/devices/+/rpc/supported')
  async onDeviceMethods(
    @JsonMqttTopic() topic: string,
    @JsonMqttPayload(new ZodValidationPipe(DeviceMethodSchema.array())) methods: DeviceMethodDto[]
  ) {
    const id = topic.split('/')[2];
    await this.deviceService.reportDeviceMethods(id, methods);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { DeviceService } from './device.service';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { DeviceMethodSchema, DevicePropertiesDtoSchema } from '@nano-iot/common';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';
import { JsonMqttPayload, JsonMqttSubscribe, JsonMqttTopic } from '../mqtt/rpc.decorator';
import {
  CreateDeviceDto,
  DeviceDto,
  DeviceMethodDto,
  DevicePropertiesDto,
  DeviceWithCredentialsDto,
} from '../models';

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
  @ZodResponse({ type: DevicePropertiesDto })
  async getDeviceProperties(@Param('id') id: string) {
    const device = await this.deviceService.getDevice(id);
    return device.properties;
  }

  @Get(':id/configuration')
  @ZodResponse({ type: DevicePropertiesDto })
  async getDeviceConfiguration(@Param('id') id: string) {
    const device = await this.deviceService.getDevice(id);
    return device.configuration;
  }

  @Put(':id/configuration')
  @ZodResponse({ type: DevicePropertiesDto })
  async updateDeviceConfiguration(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DevicePropertiesDtoSchema))
    configuration: Record<string, unknown>,
  ) {
    const config = await this.deviceService.setDeviceConfiguration({
      deviceId: id,
      configuration,
    });
    return config;
  }

  @Get(':id/tags')
  @ZodResponse({ type: DevicePropertiesDto })
  async getDeviceTags(@Param('id') id: string) {
    const device = await this.deviceService.getDevice(id);
    return device.tags;
  }

  @Put(':id/tags')
  @ZodResponse({ type: DevicePropertiesDto })
  async updateDeviceTags(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DevicePropertiesDtoSchema))
    tags: Record<string, unknown>,
  ) {
    const result = await this.deviceService.setDeviceTags({
      deviceId: id,
      tags,
    });
    return result;
  }

  @JsonMqttSubscribe('iot/devices/+/properties')
  async onDeviceProperties(
    @JsonMqttTopic() topic: string,
    @JsonMqttPayload(new ZodValidationPipe(DevicePropertiesDtoSchema))
    properties: Record<string, unknown>,
  ) {
    const id = topic.split('/')[2];
    await this.deviceService.reportDeviceProperties(id, properties);
  }

  @JsonMqttSubscribe('iot/devices/+/rpc/supported')
  async onDeviceMethods(
    @JsonMqttTopic() topic: string,
    @JsonMqttPayload(new ZodValidationPipe(DeviceMethodSchema.array())) methods: DeviceMethodDto[],
  ) {
    const id = topic.split('/')[2];
    await this.deviceService.reportDeviceMethods(id, methods);
  }
}

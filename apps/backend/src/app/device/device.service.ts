import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CertificateService, Credentials } from '../mqtt/certificate.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceEntity, DeviceMethodEntity } from './device.entity';
import { Repository } from 'typeorm';
import {
  type CreateDeviceDto,
  CreateDeviceDtoSchema,
  DeviceDto,
  DeviceDtoSchema,
  DeviceMethodDto,
  type DevicePropertiesDto,
  DevicePropertiesDtoSchema,
  DeviceWithCredentialsDto,
  DeviceWithCredentialsDtoSchema,
} from '@nano-iot/common';
import { MqttService } from '../mqtt/mqtt.service';
import { RpcService } from '../mqtt/rpc.service';
import { z } from 'zod';
import { RpcParams } from 'jsonrpc-lite';
import { McpTool } from '../lib/mcp';

const ObjectSchema = z.custom((data) => typeof data === 'object' && data !== null);
ObjectSchema._zod.toJSONSchema = () => z.toJSONSchema(z.object());

const CallDeviceMethodDtoSchema = z.object({
  deviceId: z.string().describe('The ID of the device'),
  method: z.string().describe('The name of the method to call'),
  params: z
    .union([ObjectSchema, z.array(z.any())])
    .describe('The parameters to pass to the method') as z.core.$ZodType<RpcParams>,
});
export type CallDeviceMethodDto = z.infer<typeof CallDeviceMethodDtoSchema>;

const SetDeviceConfigurationDtoSchema = z.object({
  deviceId: z.string().describe('The ID of the device'),
  configuration: DevicePropertiesDtoSchema.describe('The configuration to set on the device'),
});
export type SetDeviceConfigurationDto = z.infer<typeof SetDeviceConfigurationDtoSchema>;

const SetDeviceTagsDtoSchema = z.object({
  deviceId: z.string().describe('The ID of the device'),
  tags: DevicePropertiesDtoSchema.describe('The tags to set on the device'),
});
export type SetDeviceTagsDto = z.infer<typeof SetDeviceTagsDtoSchema>;

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(DeviceEntity) private deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(DeviceEntity) private deviceMethodRepo: Repository<DeviceMethodEntity>,
    private certificateService: CertificateService,
    private mqttService: MqttService,
    private rpcService: RpcService,
  ) {}

  async getDevices() {
    const devices = await this.deviceRepo.find({ relations: ['methods'] });
    return devices.map((d) => this.toDeviceDto(d));
  }

  @McpTool({
    name: 'get-device',
    description: 'Get a device by ID',
    parameters: z.object({ id: z.string().describe('The ID of the device') }),
    outputSchema: DeviceDtoSchema,
  })
  async getDevice(id: string | { id: string }) {
    const deviceId = typeof id === 'string' ? id : id.id;
    const device = await this.deviceRepo.findOneOrFail({
      where: { id: deviceId },
      relations: ['methods'],
    });
    return this.toDeviceDto(device);
  }

  @McpTool({
    name: 'create-device',
    description: 'Creates a new device with the given ID',
    parameters: CreateDeviceDtoSchema,
    outputSchema: DeviceWithCredentialsDtoSchema,
  })
  async createDevice(dto: CreateDeviceDto) {
    const existing = await this.deviceRepo.findOneBy({ id: dto.id });
    if (existing) {
      throw new ConflictException('Device with this ID already exists');
    }

    const credentials = await this.certificateService.createCertificate(dto.id);
    const device = await this.deviceRepo.save(dto);
    return this.toDeviceWithCredentialsDto(device, credentials);
  }

  @McpTool({
    name: 'delete-device',
    description: 'Deletes a device with the given ID',
    parameters: z.object({ id: z.string().describe('The ID of the device') }),
    annotations: {
      destructiveHint: true,
    },
  })
  async deleteDevice(id: string | { id: string }) {
    const deviceId = typeof id === 'string' ? id : id.id;
    await this.certificateService.revokeCertificate(deviceId);
    await this.deviceRepo.delete({ id: deviceId });
    return {};
  }

  async reportDeviceProperties(id: string, properties: DevicePropertiesDto) {
    await this.deviceRepo.update({ id }, { properties });
  }

  async reportDeviceConfiguration(id: string, configuration: DevicePropertiesDto) {
    await this.deviceRepo.update({ id }, { configuration });
  }

  @McpTool({
    name: 'set-device-configuration',
    description: 'Set configuration of a device with the given ID',
    parameters: SetDeviceConfigurationDtoSchema,
    outputSchema: DevicePropertiesDtoSchema,
  })
  async setDeviceConfiguration(dto: SetDeviceConfigurationDto) {
    const device = await this.deviceRepo.findOneOrFail({
      where: { id: dto.deviceId },
      relations: ['methods'],
    });

    await this.deviceRepo.update({ id: dto.deviceId }, { configuration: dto.configuration });
    await this.mqttService.publish(`iot/devices/${dto.deviceId}/configuration`, dto.configuration);

    return this.toDeviceDto({ ...device, configuration: dto.configuration }).configuration;
  }

  @McpTool({
    name: 'set-device-tags',
    description: 'Set tags of a device with the given ID',
    parameters: SetDeviceTagsDtoSchema,
    outputSchema: DevicePropertiesDtoSchema,
  })
  async setDeviceTags(dto: SetDeviceTagsDto) {
    const device = await this.deviceRepo.findOneOrFail({
      where: { id: dto.deviceId },
      relations: ['methods'],
    });

    await this.deviceRepo.update({ id: dto.deviceId }, { tags: dto.tags });

    return this.toDeviceDto({ ...device, tags: dto.tags }).tags;
  }

  async reportDeviceMethods(id: string, methods: DeviceMethodDto[]) {
    const device = await this.deviceRepo.findOneBy({ id });
    if (device) {
      await this.deviceMethodRepo.manager.transaction(async (em) => {
        const repo = em.getRepository(DeviceMethodEntity);
        await repo.delete({ deviceId: device.id });
        await repo.save(methods.map((m) => ({ ...m, deviceId: device.id })));
      });
    }
  }

  @McpTool({
    name: 'call-device-method',
    description: 'Invoke a device method',
    parameters: CallDeviceMethodDtoSchema,
    outputSchema: z.any(),
  })
  async callDeviceMethod(dto: CallDeviceMethodDto) {
    const device = await this.deviceRepo.findOneOrFail({
      where: { id: dto.deviceId },
      relations: ['methods'],
    });
    if (!device.methods.some((m) => m.name === dto.method)) {
      throw new NotFoundException('Device method not found');
    }

    const result = await this.rpcService.callDeviceMethod(device.id, dto.method, dto.params);
    return result;
  }

  private toDeviceDto(entity: DeviceEntity): DeviceDto {
    return DeviceDtoSchema.parse(entity);
  }

  private toDeviceWithCredentialsDto(
    entity: DeviceEntity,
    credentials: Credentials,
  ): DeviceWithCredentialsDto {
    return DeviceWithCredentialsDtoSchema.parse({
      ...entity,
      mqtt: {
        uri: this.mqttService.uri,
        ca: credentials.ca,
        certificate: credentials.certificate,
        key: credentials.key,
      },
    });
  }
}

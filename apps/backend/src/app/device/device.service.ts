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
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';

const CallDeviceMethodDtoSchema = z.object({
  deviceId: z.string().describe('The ID of the device'),
  method: z.string().describe('The name of the method to call'),
  params: z
    .union([z.object({}), z.array(z.any())])
    .describe('The parameters to pass to the method'),
});
export type CallDeviceMethodDto = z.infer<typeof CallDeviceMethodDtoSchema>;

const SetDevicePropertiesDtoSchema = z.object({
  deviceId: z.string().describe('The ID of the device'),
  properties: DevicePropertiesDtoSchema.describe('The properties to set on the device'),
});
export type SetDevicePropertiesDto = z.infer<typeof SetDevicePropertiesDtoSchema>;

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(DeviceEntity) private deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(DeviceEntity) private deviceMethodRepo: Repository<DeviceMethodEntity>,
    private certificateService: CertificateService,
    private mqttService: MqttService,
    private rpcService: RpcService
  ) {}

  async getDevices() {
    const devices = await this.deviceRepo.find({ relations: ['methods'] });
    return devices.map((d) => this.toDeviceDto(d));
  }

  @Tool({
    name: 'get-device',
    description: 'Get a device by ID',
    parameters: z.object({ id: z.string({ description: 'The ID of the device' }) }),
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

  @Tool({
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

  @Tool({
    name: 'delete-device',
    description: 'Deletes a device with the given ID',
    parameters: z.object({ id: z.string({ description: 'The ID of the device' }) }),
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

  @Tool({
    name: 'set-device-properties',
    description: 'Set properties of a device with the given ID',
    parameters: SetDevicePropertiesDtoSchema,
  })
  async setDeviceProperties(dto: SetDevicePropertiesDto) {
    const device = await this.deviceRepo.findOneOrFail({
      where: { id: dto.deviceId },
      relations: ['methods'],
    });

    await this.deviceRepo.update({ id: dto.deviceId }, { properties: dto.properties });
    await this.mqttService.publish(
      `iot/devices/${dto.deviceId}/properties/desired`,
      dto.properties
    );

    return this.toDeviceDto({ ...device, properties: dto.properties });
  }

  async reportDeviceProperties(id: string, properties: DevicePropertiesDto) {
    await this.deviceRepo.update({ id }, { properties });
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

  @Tool({
    name: 'call-device-method',
    description: 'Invoke a device method',
    parameters: CallDeviceMethodDtoSchema,
    outputSchema: z.any(),
  })
  async callDeviceMethod(dto: CallDeviceMethodDto) {
    const device = await this.deviceRepo.findOneByOrFail({ id: dto.deviceId });
    if (!device.methods.find((m) => m.name === dto.method)) {
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
    credentials: Credentials
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

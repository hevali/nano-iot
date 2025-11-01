import { ConflictException, Injectable } from '@nestjs/common';
import { CertificateService, Credentials } from '../mqtt/certificate.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceEntity, DeviceMethodEntity } from './device.entity';
import { Repository } from 'typeorm';
import {
  CreateDeviceDto,
  DeviceDto,
  DeviceMethodDto,
  DeviceWithCredentialsDto,
} from '@nano-iot/common';
import { MqttService } from '../mqtt/mqtt.service';
import { RpcService } from '../mqtt/rpc.service';
import { RpcParams } from 'jsonrpc-lite';

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

  async getDevice(id: string) {
    const device = await this.deviceRepo.findOneOrFail({ where: { id }, relations: ['methods'] });
    return this.toDeviceDto(device);
  }

  async createDevice(dto: CreateDeviceDto) {
    const existing = await this.deviceRepo.findOneBy({ id: dto.id });
    if (existing) {
      throw new ConflictException('Device with this ID already exists');
    }

    const credentials = await this.certificateService.createCertificate(dto.id);
    const device = await this.deviceRepo.save(dto);
    return this.toDeviceWithCredentialsDto(device, credentials);
  }

  async deleteDevice(id: string) {
    await this.certificateService.revokeCertificate(id);
    await this.deviceRepo.delete({ id });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async setDeviceProperties(id: string, properties: Record<string, any>) {
    const device = await this.deviceRepo.findOneOrFail({ where: { id }, relations: ['methods'] });

    await this.deviceRepo.update({ id }, { properties });
    await this.mqttService.publish(`iot/devices/${id}/properties/desired`, properties);

    return this.toDeviceDto({ ...device, properties });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async reportDeviceProperties(id: string, properties: Record<string, any>) {
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

  async callDeviceMethod(id: string, method: string, params: RpcParams) {
    const device = await this.deviceRepo.findOneByOrFail({ id });

    const result = await this.rpcService.callDeviceMethod(device.id, method, params);
    return result;
  }

  private toDeviceDto(entity: DeviceEntity): DeviceDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      properties: entity.properties,
      methods: entity.methods.map((m) => this.toDeviceMethodDto(m)),
    };
  }

  private toDeviceMethodDto(entity: DeviceMethodEntity): DeviceMethodDto {
    return {
      name: entity.name,
      description: entity.description,
      definition: entity.definition,
    };
  }

  private toDeviceWithCredentialsDto(
    entity: DeviceEntity,
    credentials: Credentials
  ): DeviceWithCredentialsDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      properties: entity.properties,
      ca: credentials.ca,
      certificate: credentials.certificate,
      key: credentials.key,
    };
  }
}

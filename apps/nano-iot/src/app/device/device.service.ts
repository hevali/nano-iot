import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { CertificateService } from '../mqtt/certificate.service';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceEntity } from './device.entity';
import { Repository } from 'typeorm';
import { DeviceDto, DeviceWithCredentialsDto } from './device.dto';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(DeviceEntity) private deviceRepo: Repository<DeviceEntity>,
    private certificateService: CertificateService,
    private mqttService: MqttService
  ) {}

  async getDevices() {
    const devices = await this.deviceRepo.find();
    return devices.map((d) => this.toDto(d));
  }

  async getDevice(id: string) {
    const device = await this.deviceRepo.findOneByOrFail({ id });
    return this.toDto(device);
  }

  async createDevice(id: string) {
    const existing = await this.deviceRepo.findOneBy({ id });
    if (existing) {
      throw new ConflictException('Device with this ID already exists');
    }

    const device = await this.deviceRepo.save({ id });
    const { key, certificate } = await this.certificateService.createCertificate(id);
    return this.toDeviceWithCredentialsDto(device, key, certificate);
  }

  async deleteDevice(id: string) {
    await this.deviceRepo.delete({ id });
  }

  async setDeviceProperties(id: string, properties: Record<string, any>) {
    const device = await this.deviceRepo.findOneByOrFail({ id });

    await this.deviceRepo.update({ id }, { properties });
    await this.mqttService.publish(`iot/devices/${id}/properties/desired`, properties);

    return this.toDto({ ...device, properties });
  }

  async reportDeviceProperties(id: string, properties: Record<string, any>) {
    await this.deviceRepo.update({ id }, { properties });
  }

  private toDto(entity: DeviceEntity): DeviceDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      properties: entity.properties,
    };
  }

  private toDeviceWithCredentialsDto(
    entity: DeviceEntity,
    key: string,
    certificate: string
  ): DeviceWithCredentialsDto {
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      properties: entity.properties,
      key,
      certificate,
    };
  }
}

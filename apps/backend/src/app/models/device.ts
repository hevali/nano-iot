import {
  DeviceDtoSchema,
  DeviceMethodSchema,
  DeviceWithCredentialsDtoSchema,
  CreateDeviceDtoSchema,
} from '@nano-iot/common';
import { createZodDto } from 'nestjs-zod';

export class DeviceMethodDto extends createZodDto(DeviceMethodSchema) {}
export class DeviceDto extends createZodDto(DeviceDtoSchema) {}
export class DeviceWithCredentialsDto extends createZodDto(DeviceWithCredentialsDtoSchema) {}
export class CreateDeviceDto extends createZodDto(CreateDeviceDtoSchema) {}

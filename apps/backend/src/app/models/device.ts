import {
  DeviceDtoSchema,
  DeviceMethodSchema,
  DeviceWithCredentialsDtoSchema,
  CreateDeviceDtoSchema,
  DevicePropertiesDtoSchema,
} from '@nano-iot/common';
import { createZodDto } from 'nestjs-zod';

export class DeviceDto extends createZodDto(DeviceDtoSchema) {}
export class DevicePropertiesDto extends createZodDto(DevicePropertiesDtoSchema) {}
export class DeviceMethodDto extends createZodDto(DeviceMethodSchema) {}
export class DeviceWithCredentialsDto extends createZodDto(DeviceWithCredentialsDtoSchema) {}
export class CreateDeviceDto extends createZodDto(CreateDeviceDtoSchema) {}

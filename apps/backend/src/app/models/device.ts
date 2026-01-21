import {
  DeviceDtoSchema,
  DeviceMethodSchema,
  DeviceWithCredentialsDtoSchema,
  CreateDeviceDtoSchema,
  DevicePropertiesDtoSchema,
} from '@nano-iot/common';
import { createZodDto } from 'nestjs-zod';

export class DeviceDto extends createZodDto(DeviceDtoSchema, { codec: true }) {}
export class DevicePropertiesDto extends createZodDto(DevicePropertiesDtoSchema, { codec: true }) {}
export class DeviceMethodDto extends createZodDto(DeviceMethodSchema, { codec: true }) {}
export class DeviceWithCredentialsDto extends createZodDto(DeviceWithCredentialsDtoSchema, {
  codec: true,
}) {}
export class CreateDeviceDto extends createZodDto(CreateDeviceDtoSchema, { codec: true }) {}

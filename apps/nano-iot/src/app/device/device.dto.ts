import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { zDate } from '../lib/api';

export const DevicePropetiesSchema = z.record(z.string(), z.any());

const DeviceDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
  properties: DevicePropetiesSchema,
});

export class DeviceDto extends createZodDto(DeviceDtoSchema) {}

const DeviceWithCredentialsDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
  properties: DevicePropetiesSchema,
  key: z.string(),
  certificate: z.string(),
});

export class DeviceWithCredentialsDto extends createZodDto(DeviceWithCredentialsDtoSchema) {}

const CreateDeviceDtoSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9-_]+$/),
  properties: DevicePropetiesSchema.optional(),
});

export class CreateDeviceDto extends createZodDto(CreateDeviceDtoSchema) {}

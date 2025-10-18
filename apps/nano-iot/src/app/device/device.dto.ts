import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { zDate } from '../lib/api';

const DeviceDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
  properties: z.record(z.string(), z.any()),
});

export class DeviceDto extends createZodDto(DeviceDtoSchema) {}

const DeviceWithCredentialsDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
  properties: z.record(z.string(), z.any()),
  key: z.string(),
  certificate: z.string(),
});

export class DeviceWithCredentialsDto extends createZodDto(DeviceWithCredentialsDtoSchema) {}

const CreateDeviceDtoSchema = z.object({
  id: z.string().min(3).max(32),
  properties: z.record(z.string(), z.any()).optional(),
});

export class CreateDeviceDto extends createZodDto(CreateDeviceDtoSchema) {}

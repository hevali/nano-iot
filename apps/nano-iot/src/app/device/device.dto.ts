import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import Ajv from 'ajv';
import { zDate } from '../lib/api';

const ajv = new Ajv();

const isJsonSchema = (data: any) => {
  try {
    ajv.compile(data);
    return true;
  } catch (e) {
    return false;
  }
};

export const DevicePropetiesSchema = z.record(z.string(), z.any());

export const DeviceMethodSchema = z.object({
  name: z.string(),
  description: z.string(),
  definition: z.object({
    params: z
      .union([
        z.array(z.any().refine(isJsonSchema, { error: 'Invalid JSON Schema' })),
        z.any().refine(isJsonSchema, { error: 'Invalid JSON Schema' }),
      ])
      .optional(),
    result: z.union([z.any().refine(isJsonSchema, { error: 'Invalid JSON Schema' }), z.null()]),
  }),
});

export class DeviceMethodDto extends createZodDto(DeviceMethodSchema) {}

const DeviceDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
  properties: DevicePropetiesSchema,
  methods: DeviceMethodSchema.array(),
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

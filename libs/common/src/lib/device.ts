import { z } from 'zod';
import { Ajv } from 'ajv';

const ajv = new Ajv();

const zJsonSchema = z.any().refine(
  (data: any) => {
    try {
      ajv.compile(data);
      return true;
    } catch {
      return false;
    }
  },
  { error: 'Invalid JSON Schema' }
);

export const DevicePropertiesDtoSchema = z.record(z.string(), z.any());

export const DeviceMethodSchema = z.object({
  name: z.string(),
  description: z.string(),
  definition: z.object({
    params: z.union([z.array(zJsonSchema), zJsonSchema]).optional(),
    result: z.union([zJsonSchema, z.null()]),
  }),
});

export const DeviceDtoSchema = z.object({
  id: z.string(),
  createdAt: z.iso.date(),
  properties: DevicePropertiesDtoSchema,
  methods: DeviceMethodSchema.array(),
});

export const DeviceWithCredentialsDtoSchema = z.object({
  id: z.string(),
  createdAt: z.iso.date(),
  properties: DevicePropertiesDtoSchema,
  mqtt: z.object({
    uri: z.string(),
    ca: z.string(),
    certificate: z.string(),
    key: z.string(),
  }),
});

export const CreateDeviceDtoSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9-_]+$/)
    .describe('The unique identifier for the device'),
  properties: DevicePropertiesDtoSchema.optional().describe('Initial properties for the device'),
});

export type DeviceDto = z.infer<typeof DeviceDtoSchema>;
export type DevicePropertiesDto = z.infer<typeof DevicePropertiesDtoSchema>;
export type DeviceMethodDto = z.infer<typeof DeviceMethodSchema>;
export type DeviceWithCredentialsDto = z.infer<typeof DeviceWithCredentialsDtoSchema>;
export type CreateDeviceDto = z.infer<typeof CreateDeviceDtoSchema>;

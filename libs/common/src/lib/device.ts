import { z } from 'zod';
import { Ajv } from 'ajv';

const ajv = new Ajv();

const zJsonSchema = z.any().refine(
  (data) => {
    try {
      ajv.compile(data);
      return true;
    } catch {
      return false;
    }
  },
  { error: 'Invalid JSON Schema' }
);

const zDate = z.codec(z.union([z.iso.datetime(), z.date()]), z.date(), {
  decode: (stringOrDate) => new Date(stringOrDate),
  encode: (date) => date.toISOString(),
}) as unknown as z.ZodCodec<z.ZodISODateTime, z.ZodDate>;
zDate._zod.toJSONSchema = () => z.toJSONSchema(z.iso.datetime());

export const DevicePropertiesDtoSchema = z.record(z.string(), z.any());

export const DeviceMethodSchema = z.object({
  name: z.string(),
  description: z.string(),
  definition: z.object({
    params: z.union([z.array(zJsonSchema), zJsonSchema]).optional(),
    result: z.union([zJsonSchema, z.null()]),
  }),
});

const SimpleDeviceDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate,
  properties: DevicePropertiesDtoSchema,
});

export const DeviceDtoSchema = z.object({
  ...SimpleDeviceDtoSchema.shape,
  methods: DeviceMethodSchema.array(),
});

export const DeviceWithCredentialsDtoSchema = z.object({
  ...SimpleDeviceDtoSchema.shape,
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

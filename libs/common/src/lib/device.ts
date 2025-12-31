import { z } from 'zod';
import { Ajv } from 'ajv';

const ajv = new Ajv();

// Note: zod v3 does not expose the internal JSON schema helpers used in previous
// code (like modifying _zod.toJSONSchema). Remove that hack and use preprocessing
// and AJV for JSON Schema validation where needed.

export const zJsonSchema = z.any().refine(
  (data: unknown) => {
    try {
      ajv.compile(data as object);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid JSON Schema' }
);

export function zDate() {
  // Accept either a Date or an ISO date string and coerce strings to Date using preprocess.
  return z.preprocess((arg: unknown) => {
    if (typeof arg === 'string') {
      const d = new Date(arg);
      return isNaN(d.getTime()) ? arg : d;
    }
    return arg;
  }, z.date());
}

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
  createdAt: zDate(),
  properties: DevicePropertiesDtoSchema,
  methods: DeviceMethodSchema.array(),
});

export const DeviceWithCredentialsDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
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

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Ajv } from 'ajv';

const ajv = new Ajv();

function overrideJSONSchema<T>(p: z.ZodType<T>, customJSONSchema: unknown): z.ZodType<T> {
  const wrappedInstance = p.meta({});
  wrappedInstance._zod.toJSONSchema = () => {
    return customJSONSchema;
  };
  return wrappedInstance.meta({});
}

export const zJsonSchema = z.any().refine(
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

export function zDate(): z.ZodType<Date> {
  return overrideJSONSchema(
    z.union([z.date(), z.iso.datetime().pipe(z.coerce.date())]),
    z.toJSONSchema(z.iso.datetime())
  );
}

export const DevicePropertiesSchema = z.record(z.string(), z.any());

export const DeviceMethodSchema = z.object({
  name: z.string(),
  description: z.string(),
  definition: z.object({
    params: z.union([z.array(zJsonSchema), zJsonSchema]).optional(),
    result: z.union([zJsonSchema, z.null()]),
  }),
});

export class DeviceMethodDto extends createZodDto(DeviceMethodSchema) {}

const DeviceDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
  properties: DevicePropertiesSchema,
  methods: DeviceMethodSchema.array(),
});

export class DeviceDto extends createZodDto(DeviceDtoSchema) {}

const DeviceWithCredentialsDtoSchema = z.object({
  id: z.string(),
  createdAt: zDate(),
  properties: DevicePropertiesSchema,
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
  properties: DevicePropertiesSchema.optional(),
});

export class CreateDeviceDto extends createZodDto(CreateDeviceDtoSchema) {}

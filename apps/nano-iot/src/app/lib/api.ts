import { z } from 'zod';

function overrideJSONSchema<T>(p: z.ZodType<T>, customJSONSchema: unknown): z.ZodType<T> {
  const wrappedInstance = p.meta({});
  wrappedInstance._zod.toJSONSchema = () => {
    return customJSONSchema;
  };
  return wrappedInstance.meta({});
}

export function zDate(): z.ZodType<Date> {
  return overrideJSONSchema(
    z.union([z.date(), z.iso.datetime().pipe(z.coerce.date())]),
    z.toJSONSchema(z.iso.datetime())
  );
}

import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const CONFIG_SCHEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_TRUST_PROXY: z.coerce.boolean().default(false),
  APP_MQTT_PORT: z.coerce.number().int().min(1).max(65535).default(1884),
  APP_MQTT_SERVER_CERT: z.string(),
  APP_MQTT_SERVER_KEY: z.string(),
  APP_MQTT_ROOT_CERT: z.string(),
  APP_GEMINI_API_KEY: z.string(),
});

export type IConfigService = ConfigService<z.infer<typeof CONFIG_SCHEMA>>;

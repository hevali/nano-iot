import { LOG_LEVELS } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import * as path from 'path';

export const CONFIG_SCHEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('log'),

  APP_HTTP_URL: z.string(),
  APP_TRUST_PROXY: z.coerce.boolean().default(false),

  APP_MQTT_PORT: z.coerce.number().int().min(1).max(65535).default(1884),
  APP_EXTERNAL_MQTT_HOST: z.string(),
  APP_EXTERNAL_MQTT_PORT: z.string(),

  APP_MQTT_SERVER_CERT: z.string().optional(),
  APP_MQTT_SERVER_CERT_PATH: z.string().optional(),
  APP_MQTT_SERVER_KEY: z.string().optional(),
  APP_MQTT_SERVER_KEY_PATH: z.string().optional(),

  APP_MQTT_TLS_CERT: z.string().optional(),
  APP_MQTT_TLS_CERT_PATH: z.string().optional(),
  APP_MQTT_TLS_KEY: z.string().optional(),
  APP_MQTT_TLS_KEY_PATH: z.string().optional(),

  APP_GEMINI_API_KEY: z.string(),

  APP_DATA_DIR: z.string().default(path.join(__dirname, '..', 'data')),
  APP_SESSION_SECRET: z.string(),
  APP_INITIAL_USER: z.string(),
  APP_BASE_PATH: z.string().optional(),
});

export type TypedConfigService = ConfigService<z.infer<typeof CONFIG_SCHEMA>>;

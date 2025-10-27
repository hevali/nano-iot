import { LOG_LEVELS } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import * as path from 'path';

export const CONFIG_SCHEMA = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('log'),

  APP_TRUST_PROXY: z.coerce.boolean().default(false),

  APP_MQTT_PORT: z.coerce.number().int().min(1).max(65535).default(1884),
  APP_MQTT_CERTS_DIR: z.string().default(path.join(__dirname, '..', 'certs')),

  APP_MQTT_SERVER_CERT: z.string().optional(),
  APP_MQTT_SERVER_CERT_PATH: z.string().optional(),
  APP_MQTT_SERVER_KEY: z.string().optional(),
  APP_MQTT_SERVER_KEY_PATH: z.string().optional(),

  APP_MQTT_TLS_CERT: z.string().optional(),
  APP_MQTT_TLS_CERT_PATH: z.string().optional(),
  APP_MQTT_TLS_KEY: z.string().optional(),
  APP_MQTT_TLS_KEY_PATH: z.string().optional(),

  APP_GEMINI_API_KEY: z.string(),

  APP_DATA_PATH: z.string().default(path.join(__dirname, '..')),
  APP_SESSION_SECRET: z.string(),
  APP_INITIAL_USER: z.string(),
});

export type TypedConfigService = ConfigService<z.infer<typeof CONFIG_SCHEMA>>;

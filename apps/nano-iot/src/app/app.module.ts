import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

import { MqttModule } from './mqtt/mqtt.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().port().default(3000),
        APP_MQTT_PORT: Joi.number().port().default(1884),
        APP_MQTT_ROOT_KEY: Joi.string(),
        APP_MQTT_ROOT_CERT: Joi.string(),
      }),
    }),
    MqttModule,
  ],
})
export class AppModule {}

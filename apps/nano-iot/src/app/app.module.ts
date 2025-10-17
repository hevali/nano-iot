import { Module } from '@nestjs/common';

import { MqttModule } from './mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
})
export class AppModule {}

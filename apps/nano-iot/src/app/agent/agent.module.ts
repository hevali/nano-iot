import { Module } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { AgentService } from './agent.service';
import { DeviceModule } from '../device/device.module';
import { AgentController } from './agent.controller';

@Module({
  imports: [DeviceModule],
  providers: [
    {
      provide: GoogleGenAI,
      useFactory: (config: ConfigService) => {
        return new GoogleGenAI({ apiKey: config.get('APP_GEMINI_API_KEY') });
      },
      inject: [ConfigService],
    },
    AgentService,
  ],
  controllers: [AgentController],
})
export class AgentModule {}

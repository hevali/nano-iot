import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentService } from './agent.service';
import { DeviceModule } from '../device/device.module';
import { AgentController } from './agent.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatEntity, ChatMessageEntity } from './chat.entity';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { TypedConfigService } from '../lib/config';
import { McpService } from './mcp.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatEntity, ChatMessageEntity]), DeviceModule],
  providers: [
    {
      provide: ChatGoogleGenerativeAI,
      useFactory: (config: TypedConfigService) => {
        return new ChatGoogleGenerativeAI({
          model: 'gemini-3.0-flash',
          apiKey: config.get('APP_GEMINI_API_KEY', ''),
          temperature: 0.2,
        });
      },
      inject: [ConfigService],
    },
    AgentService,
    McpService,
  ],
  controllers: [AgentController],
})
export class AgentModule {}

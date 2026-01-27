import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeviceModule } from '../device/device.module';
import { TypedConfigService } from '../lib/config';
import { A2AExecutor } from './a2a';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ChatEntity, ChatMessageEntity } from './chat.entity';
import { McpService } from './mcp.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatEntity, ChatMessageEntity]), DeviceModule],
  providers: [
    {
      provide: ChatGoogleGenerativeAI,
      useFactory: (config: TypedConfigService) => {
        return new ChatGoogleGenerativeAI({
          model: 'gemini-3-flash-preview',
          apiKey: config.getOrThrow<string>('APP_GEMINI_API_KEY'),
          temperature: 0.2,
        });
      },
      inject: [ConfigService],
    },
    AgentService,
    McpService,
    A2AExecutor,
  ],
  controllers: [AgentController],
})
export class AgentModule {}

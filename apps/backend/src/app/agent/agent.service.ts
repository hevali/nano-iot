import { DeviceService } from '../device/device.service';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatEntity, ChatMessageEntity } from './chat.entity';
import { Repository } from 'typeorm';
import { Logger, OnModuleInit, Injectable } from '@nestjs/common';
import { createAgent, createMiddleware, ReactAgent, tool } from 'langchain';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { BaseMessage, ChatMessage, HumanMessage } from '@langchain/core/messages';

@Injectable()
export class AgentService implements OnModuleInit {
  private logger = new Logger(AgentService.name);
  private agent!: ReactAgent;

  constructor(
    private model: ChatGoogleGenerativeAI,
    private deviceService: DeviceService,
    @InjectRepository(ChatEntity) private chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMessageEntity) private chatMessageRepo: Repository<ChatMessageEntity>
  ) {}

  async onModuleInit() {
    const loggerMiddleware = createMiddleware({
      name: 'Logger',
      beforeModel: (args) => this.logger.debug('AI request', args.messages.at(-1)),
    });

    const callDeviceAgent = tool(
      async ({ deviceId, task }) => {
        const device = await this.deviceService.getDevice(deviceId);

        const deviceAgent = createAgent({
          model: this.model,
          tools: device.methods.map((m) =>
            tool(
              ({ name, params }) => this.deviceService.callDeviceMethod(device.id, name, params),
              {
                name: m.name,
                description: m.description,
                schema: m.definition.params,
                responseFormat: m.definition.result,
              }
            )
          ),
          middleware: [loggerMiddleware],
        });

        const result = await deviceAgent.invoke({
          messages: [{ role: 'human', content: task }],
        });

        return result.messages.at(-1)?.text;
      },
      {
        name: 'DeviceAgent',
        description:
          'Dedicated agent to handle interaction with a specific device. Delegate device actions to this agent. Whenever you need information or take action on a specific device, call this agent.',
        schema: z.object({
          deviceId: z.string({ message: 'ID of the device.' }),
          task: z
            .string()
            .describe('Describe step by step what the agent should do with the device.'),
        }),
      }
    );

    const webSearchAgent = createAgent({
      model: this.model,
      tools: [{ googleSearch: {} }],
      middleware: [loggerMiddleware],
    });

    const callWebSearchAgent = tool(
      async ({ query }) => {
        const result = await webSearchAgent.invoke({
          messages: [{ role: 'human', content: query }],
        });

        return result.messages.at(-1)?.text;
      },
      {
        name: 'WebSearchAgent',
        description:
          'Use this Agent to look up information that you do not know but might be able to find through web search.',
        schema: z.object({
          query: z.string({ message: 'The web query you want to perform.' }),
        }),
      }
    );

    const getDevicesTool = tool(
      async () => this.deviceService.getDevices().then((res) => JSON.stringify(res)),
      {
        name: 'getDevices',
        description: 'Return all available devices.',
        schema: z.object({}),
      }
    );

    this.agent = createAgent({
      model: this.model,
      tools: [callDeviceAgent, callWebSearchAgent, getDevicesTool],
      systemPrompt: `You are an assistant and support the user on his questions and instructions.
You can interact with different device agents by delegating tasks to them.
You may also call specific APIs or functions directly.
If you are not sure about what to do, check the available devices and there methods. The might offer what you need.
If you receive information from another agent, pretend as if the answer comes from you.`,
      middleware: [loggerMiddleware],
    });
  }

  async callAgent(question: string, id?: string): Promise<{ id: string; text: string }> {
    const chat = await (id
      ? this.chatRepo.findOneOrFail({ where: { id }, relations: ['messages'] })
      : this.chatRepo.save({ id: randomUUID(), messages: [] }));

    const messages: BaseMessage[] = chat.messages.map(
      ({ role, text }) => new ChatMessage(text, role)
    );
    messages.push(new HumanMessage(question));

    const result = await this.agent.invoke({ messages });

    const answer = result.messages.at(-1)?.content;

    if (typeof answer !== 'string') {
      throw new Error('Non text answer');
    }

    await this.chatMessageRepo.save([
      {
        id: randomUUID(),
        chatId: chat.id,
        role: 'human',
        text: question,
      },
      {
        id: randomUUID(),
        chatId: chat.id,
        role: 'ai',
        text: answer,
      },
    ]);

    return { id: chat.id, text: answer };
  }
}

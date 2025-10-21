import {
  GoogleGenAI,
  FunctionDeclaration,
  Type,
  Content,
  GenerateContentParameters,
  CallableTool,
  Tool,
  FunctionCall,
  Part,
  ToolListUnion,
  ContentListUnion,
} from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { fetchWeatherApi } from 'openmeteo';
import { DeviceService } from '../device/device.service';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatEntity, ChatMessageEntity } from './chat.entity';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

type ToolSet = Record<
  string,
  | {
      declaration: Omit<FunctionDeclaration, 'name'>;
      handler: (...args: any[]) => Promise<unknown>;
    }
  | Agent
>;

@Injectable()
export class AgentService {
  private logger = new Logger(AgentService.name);
  private tools: ToolSet = {
    WebSearchAgent: new Agent({
      ai: this.ai,
      declaration: {
        name: 'WebSearchAgent',
        parameters: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description:
                'The web query you want to perform. Use this only to look up information that you cannot get from other agents.',
            },
          },
        },
      },
      params: {
        model: 'gemini-2.5-flash',
        contents: [],
        config: {
          systemInstruction: `Use this Agent to look up information that you do not know but might be able to find through web search.`,
          temperature: 0.2,
          thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: -1,
          },
        },
      },
      tools: ['googleSearch'],
    }),
    DeviceAgent: {
      declaration: {
        description: `Dedicated agent to handle interaction with a specific device.
          Delegate device actions to this agent.
          Whenever you need information about a device or want to do something to a specific device, call this agent.`,
        parameters: {
          type: Type.OBJECT,
          properties: {
            deviceId: {
              type: Type.STRING,
              description: 'ID of the device',
            },
            task: {
              type: Type.STRING,
              description: 'Describe step by step what the agent should do with the device',
            },
          },
        },
        response: {
          type: Type.STRING,
          description: 'The response from the agent',
        },
      },
      handler: async ({ deviceId, task }) => {
        // Create agent dynamically because we require deviceId.
        const agent = await this.createDeviceAgent(deviceId);
        const response = await agent.call(task);
        return response;
      },
    },
    getDevices: {
      declaration: {},
      handler: () => this.deviceService.getDevices(),
    },
    getCurrentWeather: {
      declaration: {
        description: `Pass the coordinates of the location to get the current weather of a specified location.`,
        parameters: {
          type: Type.OBJECT,
          properties: {
            latitude: {
              type: Type.NUMBER,
            },
            longitude: {
              type: Type.NUMBER,
            },
          },
        },
      },
      handler: async ({ latitude, longitude }) => {
        const responses = await fetchWeatherApi(
          'https://api.open-meteo.com/v1/forecast',
          {
            latitude,
            longitude,
            current: ['weather_code', 'temperature_2m'],
          },
          3
        );

        const response = responses[0];
        const current = response.current()!;
        const utcOffsetSeconds = response.utcOffsetSeconds();

        return {
          time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
          weatherCodeWMO: current.variables(0)!.value(),
          temperature2m: current.variables(1)!.value(),
        };
      },
    },
  };

  constructor(
    private ai: GoogleGenAI,
    private deviceService: DeviceService,
    @InjectRepository(ChatEntity) private chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMessageEntity) private chatMessageRepo: Repository<ChatMessageEntity>
  ) {}

  async callAgent(question: string, id?: string): Promise<{ id: string; text: string }> {
    const chat = await (id
      ? this.chatRepo.findOneOrFail({ where: { id }, relations: ['messages'] })
      : this.chatRepo.save({ id: randomUUID(), messages: [] }));

    this.logger.debug(`Chat ${chat.id}: ${question}`);

    const contents: Content[] = chat.messages.map<Content>(({ role, text }) => ({
      role,
      parts: [{ text }],
    }));

    const generalist = new Agent({
      ai: this.ai,
      declaration: {
        name: 'Generalist',
      },
      params: {
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: `You are an assistant and support the user on his questions and instructions.
You can interact with different device agents by delegating tasks to them.
You may also call specific APIs or functions directly.
If you are not sure about what to do, check the available devices and there methods. The might offer what you need.
If you receive information from another agent, pretend as if the answer comes from you.`,
          temperature: 0.2,
          thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: -1,
          },
        },
      },
      tools: this.tools,
    });

    const answer = await generalist.call(question);

    await this.chatMessageRepo.save([
      {
        id: randomUUID(),
        chatId: chat.id,
        role: 'user',
        text: question,
      },
      {
        id: randomUUID(),
        chatId: chat.id,
        role: 'model',
        text: answer,
      },
    ]);

    return { id: chat.id, text: answer };
  }

  private async createDeviceAgent(id: string): Promise<Agent> {
    const device = await this.deviceService.getDevice(id);

    const tools = device.methods.reduce<ToolSet>(
      (prev, m) => ({
        ...prev,
        [m.name]: {
          declaration: {
            description: m.description,
            parameters: m.definition.params,
            response: m.definition.result,
          },
          handler: async (args: any) => this.deviceService.callDeviceMethod(id, m.name, args),
        },
      }),
      {}
    );

    const agent = new Agent({
      ai: this.ai,
      params: {
        model: 'gemini-2.5-flash',
        contents: [],
        config: {
          systemInstruction: `You are an assistant controlling the following device:\n${JSON.stringify(
            device,
            null,
            2
          )}`,
          temperature: 0.2,
          thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: -1,
          },
        },
      },
      declaration: {
        name: 'DeviceAgent',
        description:
          'Dedicated agent to handle interaction with a specific device. Deligate device actions to this agent. Whenever you need information or take action on a specific device, call this agent.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            deviceId: {
              type: Type.STRING,
              description: 'ID of the device',
            },
            task: {
              type: Type.STRING,
              description: 'Describe step by step what the agent should do with the device',
            },
          },
        },
        response: {
          type: Type.STRING,
          description: 'The response from the agent',
        },
      },
      tools,
    });

    return agent;
  }
}

interface AgentOptions {
  ai: GoogleGenAI;
  params: GenerateContentParameters;
  declaration: FunctionDeclaration;
  tools: ToolSet | (keyof Tool)[];
}

class Agent implements CallableTool {
  private logger = new Logger(this.options.declaration.name as string);

  constructor(private options: AgentOptions) {
    if (!this.options.declaration.name) {
      throw new Error('Name is missing');
    }
  }

  async call(text: string): Promise<string> {
    const responses = await this.callTool([{ args: { text } }]);
    return responses[responses.length - 1].text || 'No response produced';
  }

  async tool(): Promise<Tool> {
    return { functionDeclarations: [this.options.declaration] };
  }

  async callTool(functionCalls: FunctionCall[]): Promise<Part[]> {
    if (!functionCalls.length || !functionCalls[0].args) {
      throw new Error('Missing function call');
    }

    const text = functionCalls[0].args['text'];
    if (typeof text !== 'string') {
      throw new Error('No instruction given');
    }

    const tools: ToolListUnion = [];
    if (Array.isArray(this.options.tools)) {
      tools.push(...this.options.tools.map((t) => ({ [t]: {} })));
    } else {
      const functionDeclarations: FunctionDeclaration[] = [];
      for (const [name, value] of Object.entries(this.options.tools)) {
        if (value instanceof Agent) {
          functionDeclarations.push({ ...value.options.declaration, name });
        } else {
          functionDeclarations.push({ ...value.declaration, name });
        }
      }

      if (functionDeclarations.length) {
        tools.push({ functionDeclarations });
      }
    }

    const contents: ContentListUnion = [];
    if (Array.isArray(this.options.params.contents)) {
      contents.push(...this.options.params.contents, { role: 'user', parts: [{ text }] });
    } else {
      contents.push(this.options.params.contents, { role: 'user', parts: [{ text }] });
    }

    const params: GenerateContentParameters = {
      ...this.options.params,
      contents,
      config: {
        ...this.options.params.config,
        tools,
      },
    };

    while (true) {
      const response = await this.options.ai.models.generateContent(params);
      if (response.functionCalls) {
        this.logger.debug('AI function call response', response.functionCalls);
      } else if (response.candidates?.length && response.candidates[0].content?.parts?.length) {
        this.logger.debug(
          'AI text response',
          response.candidates[0].content?.parts[0].text || response.functionCalls
        );
      }

      if (
        !Array.isArray(this.options.tools) &&
        response.functionCalls &&
        response.functionCalls.length > 0
      ) {
        const functionCall = response.functionCalls[0];
        const { name, args } = functionCall;
        const tool = this.options.tools[name as string];

        if (!tool) {
          throw new Error(`Unknown function call: ${name}`);
        }

        if (tool instanceof Agent) {
          const result = await tool.callTool([functionCall]);
          contents.push(...result);
          break;
        }

        let result;
        try {
          result = await tool.handler(args);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : 'Unknown error', args };
        }
        this.logger.debug('Function response', result);

        const functionResponse = { name, response: { result } };

        contents.push(
          {
            role: 'model',
            parts: [{ functionCall }],
          },
          {
            role: 'user',
            parts: [{ functionResponse }],
          }
        );
      } else {
        if (response.candidates?.length && response.candidates[0].content) {
          contents.push(response.candidates[0].content);
        }
        break;
      }
    }

    const last = contents[contents.length - 1];

    if (typeof last === 'string') {
      return [{ text: last }];
    } else if ('text' in last) {
      return [last];
    } else if ('parts' in last) {
      return last.parts || [];
    }

    return [];
  }
}

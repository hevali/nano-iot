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
} from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { fetchWeatherApi } from 'openmeteo';
import { DeviceService } from '../device/device.service';

const memory: Record<string, Content[]> = {};

type ToolSet = Record<
  string,
  {
    declaration: Omit<FunctionDeclaration, 'name'>;
    handler: (...args: any[]) => Promise<unknown>;
  }
>;

@Injectable()
export class AgentService {
  private logger = new Logger(AgentService.name);
  private tools: ToolSet = {
    DeviceAgent: {
      declaration: {
        description: `Dedicated agent to handle interaction with a specific device.
          Deligate device actions to this agent.
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
        description: `Get the current weather of a specified location`,
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

  constructor(private ai: GoogleGenAI, private deviceService: DeviceService) {}

  async callAgent(message: string, id: string): Promise<string> {
    this.logger.debug(`Chat ${id}: ${message}`);

    let contents = memory[id] || [];
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

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
            If you are not sure about what to do, check the available devices and there methods. The might offer what you need.`,
          temperature: 0.2,
          thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: -1,
          },
        },
      },
      tools: this.tools,
    });

    const result = await generalist.call(message);
    contents.push({ role: 'model', parts: [{ text: result }] });

    memory[id] = contents;

    const part = contents[contents.length - 1].parts;
    return part?.length && part[0].text ? part[0].text : 'Empty response';
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
  tools: ToolSet;
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
    return responses[responses.length - 1].text || 'No reponse produced';
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

    const contents: Content[] = [{ role: 'user', parts: [{ text }] }];
    const params: GenerateContentParameters = {
      ...this.options.params,
      contents,
      config: {
        ...this.options.params.config,
        tools: [
          {
            functionDeclarations: Object.entries(this.options.tools).map(([name, value]) => ({
              ...value.declaration,
              name,
            })),
          },
        ],
      },
    };

    while (true) {
      const response = await this.options.ai.models.generateContent(params);
      this.logger.debug('AI response', response.functionCalls);

      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        const { name, args } = functionCall;
        const tool = this.options.tools[name as string];

        if (!tool) {
          throw new Error(`Unknown function call: ${name}`);
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

    return contents[contents.length - 1].parts || [];
  }
}

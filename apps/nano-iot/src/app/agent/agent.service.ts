import { GoogleGenAI, FunctionDeclaration, Type, Content } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { DeviceService } from '../device/device.service';

const getDevices: FunctionDeclaration = {
  name: 'get_devices',
  description: 'List all available devices, their properties and methods you can call',
};

const callDeviceMethod: FunctionDeclaration = {
  name: 'call_device_method',
  description: 'Call a specific device method and get response from it',
  parameters: {
    type: Type.OBJECT,
    properties: {
      deviceId: {
        type: Type.STRING,
        description: 'ID of the device',
      },
      method: {
        type: Type.STRING,
        description: 'Name of the device method (case sensitive)',
      },
      params: {
        type: Type.OBJECT,
        description: 'Object or array of parameters to send to the method',
      },
    },
    required: ['deviceId', 'method'],
  },
};

const memory: Record<string, Content[]> = {};

@Injectable()
export class AgentService {
  private logger = new Logger(AgentService.name);

  constructor(private ai: GoogleGenAI, private deviceService: DeviceService) {}

  async callAgent(message: string, id: string): Promise<string> {
    let contents = memory[id] || [];

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const toolFunctions: Record<string, (args: any) => Promise<unknown>> = {
      get_devices: () => this.deviceService.getDevices(),
      call_device_method: ({ id, method, params }) =>
        this.deviceService.callDeviceMethod(id, method, params),
    };

    // Loop until the model has no more function calls to make
    while (true) {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction:
            'You are a home assistant and control the smart devices of a user. Follow his instructions and use the device methods to archive his intentions.',
          tools: [{ functionDeclarations: [getDevices, callDeviceMethod] }],
          temperature: 0.2,
          thinkingConfig: {
            includeThoughts: false,
            thinkingBudget: -1,
          },
        },
      });

      this.logger.debug('AI response', response.candidates, response.functionCalls);

      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];

        const { name, args } = functionCall;

        if (!toolFunctions[name as string]) {
          throw new Error(`Unknown function call: ${name}`);
        }

        let result;
        try {
          result = await toolFunctions[name as string](args);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : 'Unknown error', args };
        }

        this.logger.debug('Function response', name, result);

        const functionResponse = { name, response: { result } };

        contents.push({
          role: 'model',
          parts: [{ functionCall }],
        });
        contents.push({
          role: 'user',
          parts: [{ functionResponse }],
        });

        memory[id] = contents;
      } else {
        if (response.candidates?.length && response.candidates[0].content) {
          contents.push(response.candidates[0].content);
        }
        break;
      }
    }

    memory[id] = contents;

    const part = contents[contents.length - 1].parts;
    return part?.length && part[0].text ? part[0].text : 'Empty response';
  }
}

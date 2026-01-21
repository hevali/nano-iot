import { DeviceMethodDto } from '@nano-iot/common';
import { MqttClient } from 'mqtt';

export interface IoTDeviceOptions {
  id: string;
  methods: Record<
    string,
    {
      definition: Omit<DeviceMethodDto, 'name'>;
      handler: (...args: unknown[]) => Promise<unknown>;
    }
  >;
  properties: Record<string, unknown>;
  configuration?: Record<string, unknown>;
}

export abstract class IoTDevice {
  protected properties: Record<string, unknown>;
  protected configuration: Record<string, unknown>;
  private client: MqttClient | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;

  constructor(protected options: IoTDeviceOptions) {
    this.properties = { ...options.properties };
    this.configuration = { ...options.configuration };
  }

  async init(client: MqttClient) {
    this.client = client;
    const methods: IoTDeviceOptions['methods'] = {
      ...this.options.methods,
      ping: {
        definition: {
          description: 'Ping the device to check if it is online',
          definition: {
            result: null,
          },
        },
        handler: async () => null,
      },
    };

    client.on('message', async (topic, message) => {
      const payload = JSON.parse(message.toString());

      if (topic.startsWith(`iot/devices/${this.options.id}/rpc/request`)) {
        const id = payload['id'];
        const name = payload['method'];
        const method = methods[name];

        if (!method) {
          await client.publishAsync(
            `iot/devices/${this.options.id}/rpc/response/${id}`,
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: 'Method not found' },
            }),
          );
          return;
        }

        console.log(`Invoking method: ${name} with params:`, payload['params']);

        try {
          const result = await method.handler(payload['params']);
          await client.publishAsync(
            `iot/devices/${this.options.id}/rpc/response/${id}`,
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result,
            }),
          );
        } catch (e) {
          console.log('Error invoking method:', e);
          await client.publishAsync(
            `iot/devices/${this.options.id}/rpc/response/${id}`,
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Invalid parameters' },
            }),
          );
        }
      } else if (topic === `iot/devices/${this.options.id}/configuration`) {
        console.log('Received configuration update:', payload);
        this.configuration = { ...this.configuration, ...payload };
        await this.onConfigurationChange(payload);
      } else {
        console.warn('Unhandled topic:', topic);
      }
    });

    await client.subscribeAsync(`iot/devices/${this.options.id}/rpc/request`);
    await client.subscribeAsync(`iot/devices/${this.options.id}/configuration`);

    await this.reportProperties(this.properties);

    await client.publishAsync(
      `iot/devices/${this.options.id}/rpc/supported`,
      JSON.stringify(
        Object.entries(methods).reduce((prev, [name, { definition }]) => {
          return [...prev, { ...definition, name }];
        }, [] as DeviceMethodDto[]),
      ),
    );
  }

  protected async reportProperties(patch: Record<string, unknown>) {
    this.properties = { ...this.properties, ...patch };
    if (this.client) {
      await this.client.publishAsync(
        `iot/devices/${this.options.id}/properties`,
        JSON.stringify(this.properties),
      );
    }
  }

  protected abstract onConfigurationChange(patch: Record<string, unknown>): Promise<void>;

  protected abstract simulate(): Promise<void>;

  startSimulation(intervalMs = 5000) {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    this.simulationInterval = setInterval(() => this.simulate(), intervalMs);
    console.log(`Simulation started for ${this.options.id} with interval ${intervalMs}ms`);
  }

  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      console.log(`Simulation stopped for ${this.options.id}`);
    }
  }
}

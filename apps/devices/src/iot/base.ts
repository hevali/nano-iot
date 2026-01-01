import { DeviceMethodDto } from '@nano-iot/common';
import { connect } from 'mqtt';

export interface IoTDeviceOptions {
  id: string;
  auth: {
    ca: string;
    key: string;
    cert: string;
  };
  methods: Record<
    string,
    {
      definition: Omit<DeviceMethodDto, 'name'>;
      handler: (...args: unknown[]) => Promise<unknown>;
    }
  >;
  properties: Record<string, unknown>;
}

export abstract class IoTDevice {
  constructor(protected options: IoTDeviceOptions) {}

  async init() {
    const client = connect('mqtts://localhost:1884', {
      rejectUnauthorized: false,
      protocolVersion: 4,
      ...this.options.auth,
    });

    const methods: IoTDeviceOptions['methods'] = {
      ...this.options.methods,
      ping: {
        definition: {
          description: 'Ping the device to check if it is online',
          definition: {
            params: null,
            result: null,
          },
        },
        handler: async () => null,
      },
    };

    client.on('connect', async () => {
      console.log('Connected');

      client.on('message', async (topic, message) => {
        const payload = JSON.parse(message.toString());

        if (topic.startsWith(`iot/devices/${this.options.id}/rpc/request/`)) {
          const name = payload['name'];
          const method = methods[name];
          const id = topic.split('/')[5];

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
        } else {
          console.warn('Unhandled topic:', topic);
        }
      });

      await client.subscribeAsync(`iot/devices/${this.options.id}/rpc/request/+`);
      await client.subscribeAsync(`iot/devices/${this.options.id}/configuration`);

      await client.publishAsync(
        `iot/devices/${this.options.id}/properties`,
        JSON.stringify(this.options.properties),
      );

      await client.publishAsync(
        `iot/devices/${this.options.id}/rpc/supported`,
        JSON.stringify(
          Object.entries(methods).reduce((prev, [name, { definition }]) => {
            return [...prev, { ...definition, name }];
          }, [] as DeviceMethodDto[]),
        ),
      );
    });
  }
}

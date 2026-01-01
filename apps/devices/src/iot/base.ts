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

    client.on('connect', async () => {
      console.log('Connected');

      client.on('message', async (topic, message) => {
        const payload = JSON.parse(message.toString());

        if (topic.startsWith(`iot/devices/${this.options.id}/rpc/request/`)) {
          const name = payload['name'];
          const method = this.options.methods[name];
          if (!method) {
            return;
          }

          const result = await method.handler(payload['params']);

          const id = topic.split('/')[5];

          await client.publishAsync(
            `iot/devices/${this.options.id}/rpc/response/${id}`,
            JSON.stringify({
              jsonrpc: '2.0',
              id,
              result,
            }),
          );
        }
      });

      await client.subscribeAsync(`iot/devices/${this.options.id}/rpc/request/+`);

      await client.publishAsync(
        `iot/devices/${this.options.id}/properties`,
        JSON.stringify(this.options.properties),
      );

      await client.publishAsync(
        `iot/devices/${this.options.id}/rpc/supported`,
        JSON.stringify(
          Object.entries(this.options.methods).reduce((prev, [name, { definition }]) => {
            return [...prev, { ...definition, name }];
          }, [] as DeviceMethodDto[]),
        ),
      );
    });
  }
}

import { IoTDevice, IoTDeviceOptions } from './base';

export class PingDevice extends IoTDevice {
  constructor(id: string, auth: IoTDeviceOptions['auth']) {
    super({
      id,
      auth,
      methods: {
        ping: {
          definition: {
            description: 'Call this method to check if the device is online.',
            definition: {
              result: null,
            },
          },
          handler: (...args) => this.ping(...args),
        },
      },
      properties: {
        name: 'Ping',
        description: 'Simple IoT device that can be pinnged',
      },
    });
  }

  async ping(...args: any[]) {
    return args;
  }
}

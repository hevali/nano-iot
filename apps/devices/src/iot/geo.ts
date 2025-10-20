import { IoTDevice, IoTDeviceOptions } from './base';

export interface GeoLocation {
  latitude: string;
  longitude: string;
}

export class GeoDevice extends IoTDevice {
  constructor(id: string, auth: IoTDeviceOptions['auth'], location: GeoLocation) {
    super({
      id,
      auth,
      methods: {},
      properties: {
        name: 'Geo',
        description: 'Simple IoT device that reports its geo location',
        location,
      },
    });
  }
}

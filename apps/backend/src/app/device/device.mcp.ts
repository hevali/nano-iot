import { Injectable, Scope } from '@nestjs/common';
import { Resource } from '@rekog/mcp-nest';
import { DeviceService } from '../device/device.service';

@Injectable({ scope: Scope.REQUEST })
export class DeviceMcp {
  constructor(private deviceService: DeviceService) {}

  @Resource({
    name: 'list-devices',
    description: 'Returns a list of devices',
    mimeType: 'application/json',
    uri: 'mcp://devices',
  })
  async getDevices(req: any) {
    const devices = await this.deviceService.getDevices();
    return {
      contents: [
        {
          uri: req.uri,
          mimeType: 'application/json',
          text: JSON.stringify(devices, null, 2),
        },
      ],
    };
  }

  @Resource({
    name: 'get-device',
    description: 'Returns a device by its ID',
    mimeType: 'application/json',
    uri: 'mcp://devices/{id}',
  })
  async getDevice(req: any) {
    if (!req.id) {
      return {
        contents: [
          {
            uri: req.uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Device id missing' }),
          },
        ],
      };
    }

    const device = await this.deviceService.getDevice(req.id);
    return {
      contents: [
        {
          uri: req.uri,
          mimeType: 'application/json',
          text: JSON.stringify(device),
        },
      ],
    };
  }
}

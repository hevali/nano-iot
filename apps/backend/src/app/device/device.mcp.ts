import { Injectable, Scope } from '@nestjs/common';

import { DeviceService } from '../device/device.service';
import { McpJSONResource, McpJSONResourceTemplate } from '../lib/mcp';

@Injectable({ scope: Scope.REQUEST })
export class DeviceMcp {
  constructor(private deviceService: DeviceService) {}

  @McpJSONResource({
    name: 'list-devices',
    description: 'Returns a list of devices',
    uri: 'mcp://devices',
  })
  async getDevices() {
    const devices = await this.deviceService.getDevices();
    return devices;
  }

  @McpJSONResourceTemplate({
    name: 'get-device',
    description: 'Returns a device by its ID',
    uriTemplate: 'mcp://devices/{id}',
  })
  async getDevice(req: { id: string }) {
    const device = await this.deviceService.getDevice(req.id);
    return device;
  }
}

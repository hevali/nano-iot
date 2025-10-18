import { Controller } from '@nestjs/common';
import { MqttJsonRpc, MqttJsonRpcClientId, MqttJsonRpcParams } from './rpc.decorator';

@Controller()
export class EchoController {
  @MqttJsonRpc('echo')
  echo(@MqttJsonRpcParams('message') message: string, @MqttJsonRpcClientId() clientId: string) {
    if (message === 'error') {
      throw new Error('Echo error');
    }

    return { greeting: `Hello ${clientId}}`, message };
  }
}

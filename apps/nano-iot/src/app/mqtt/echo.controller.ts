import { Controller } from '@nestjs/common';
import { MqttJsonRpc, MqttJsonRpcClientId, MqttJsonRpcParams } from './mqtt.decorator';

@Controller()
export class EchoController {
  @MqttJsonRpc('echo')
  echo(@MqttJsonRpcParams() message: string, @MqttJsonRpcClientId() clientId: string) {
    if (message === 'error') {
      throw new Error('Echo error');
    }

    return { answer: `Hello ${clientId}}`, original: message };
  }
}

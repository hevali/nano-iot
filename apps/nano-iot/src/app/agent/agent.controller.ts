import { Controller } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JsonMqttRawPayload, JsonMqttSubscribe, JsonMqttTopic } from '../mqtt/rpc.decorator';
import { MqttService } from '../mqtt/mqtt.service';
import { randomUUID } from 'crypto';

@Controller('agents')
export class AgentController {
  constructor(private agentService: AgentService, private mqttService: MqttService) {}

  @JsonMqttSubscribe('chat')
  async startChat(@JsonMqttRawPayload() payload: string | Buffer<ArrayBufferLike>) {
    const id = randomUUID();
    const result = await this.agentService.callAgent(payload.toString(), id);
    await this.mqttService.publish(`chat/${id}`, result);
  }

  @JsonMqttSubscribe('chat/+/response')
  async continueChat(
    @JsonMqttRawPayload() payload: string | Buffer<ArrayBufferLike>,
    @JsonMqttTopic() topic: string
  ) {
    const id = topic.split('/')[1];
    const result = await this.agentService.callAgent(payload.toString(), id);
    await this.mqttService.publish(`chat/${id}`, result);
  }
}

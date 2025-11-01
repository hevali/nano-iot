import { Controller } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JsonMqttRawPayload, JsonMqttSubscribe, JsonMqttTopic } from '../mqtt/rpc.decorator';
import { MqttService } from '../mqtt/mqtt.service';

@Controller('agents')
export class AgentController {
  constructor(private agentService: AgentService, private mqttService: MqttService) {}

  @JsonMqttSubscribe('chat')
  async startChat(@JsonMqttRawPayload() payload: string | Buffer<ArrayBufferLike>) {
    const { id, text } = await this.agentService.callAgent(payload.toString());
    await this.mqttService.publish(`chat/${id}/response`, text);
  }

  @JsonMqttSubscribe('chat/+/request')
  async continueChat(
    @JsonMqttRawPayload() payload: string | Buffer<ArrayBufferLike>,
    @JsonMqttTopic() topic: string
  ) {
    const id = topic.split('/')[1];
    try {
      const { text } = await this.agentService.callAgent(payload.toString(), id);
      await this.mqttService.publish(`chat/${id}/response`, text);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.mqttService.publish(`chat/${id}/response`, e as any);
    }
  }
}

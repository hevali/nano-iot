import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import Aedes, { Client } from 'aedes';
import { IncomingMessage } from 'http';
import { promisify } from 'util';

interface MqttRequest extends IncomingMessage {
  connDetails: {
    cert: {
      subject: {
        CN: string;
      };
    };
    certAuthorized: boolean;
  };
}

@Injectable()
export class MqttService implements OnModuleInit {
  private logger = new Logger(MqttService.name);

  constructor(private aedes: Aedes) {}

  onModuleInit() {
    this.aedes.preConnect = (client, packet, cb) => {
      if ((client.req as MqttRequest).connDetails.certAuthorized) {
        this.logger.debug(`Client ${this.getClientId(client)} connected`);
        cb(null, true);
        return;
      }

      this.logger.warn(`Client connection rejected: invalid certificate`);
      cb(new Error('Invalid client certificate'), false);
    };

    this.aedes.authorizePublish = (client, packet, cb) => {
      if (packet.topic.startsWith('$SYS/')) {
        cb(new Error('Topic is reserved'));
        return;
      }

      if (!client) {
        cb(null);
        return;
      }

      const clientId = this.getClientId(client);
      this.logger.debug(`Client ${clientId} publishing to topic ${packet.topic}`);

      cb(
        this.match(`iot/devices/${clientId}/#`, packet.topic)
          ? null
          : new Error('Topic not allowed')
      );
    };

    this.aedes.authorizeSubscribe = (client, sub, cb) => {
      const clientId = this.getClientId(client);
      this.logger.debug(`Client ${clientId} subscribing to topic ${sub.topic}`);

      cb(
        this.match(`iot/devices/${clientId}/#`, sub.topic) ? null : new Error('Topic not allowed'),
        sub
      );
    };

    this.aedes.subscribe(
      `iot/devices/+/rpc/d2c`,
      async (packet, cb) => {
        const clientId = packet.topic.split('/')[2];

        try {
          const payload = JSON.parse(packet.payload.toString());

          await this.publish(`iot/devices/${clientId}/rpc/c2d`, payload);
        } catch {
          await this.onError(clientId, new Error('Invalid JSON'));
        }
      },
      () => this.logger.log('Subscribed to topic iot/devices/+/rpc/d2c')
    );
  }

  private async publish(topic: string, message: any) {
    await promisify((cb) =>
      this.aedes.publish(
        {
          topic: topic,
          payload: JSON.stringify(message),
          cmd: 'publish',
          qos: 0,
          dup: false,
          retain: true,
        },
        (err) => cb(err, null)
      )
    )();
  }

  private async onError(clientId: string, error: Error) {
    this.logger.warn(`Error client ${clientId}: ${error.message}`);

    await promisify((cb) =>
      this.aedes.publish(
        {
          topic: `iot/devices/${clientId}/rpc/error`,
          payload: JSON.stringify({ error: error.message }),
          cmd: 'publish',
          qos: 0,
          dup: false,
          retain: true,
        },
        (err) => cb(err, null)
      )
    )();
  }

  private getClientId(client: Client): string {
    return (client.req as MqttRequest).connDetails.cert.subject.CN;
  }

  // https://github.com/ralphtheninja/mqtt-match/blob/master/index.js
  private match(filter: string, topic: string) {
    const filterArray = filter.split('/');

    const length = filterArray.length;
    const topicArray = topic.split('/');

    for (let i = 0; i < length; ++i) {
      const left = filterArray[i];
      const right = topicArray[i];
      if (left === '#') {
        return topicArray.length >= length - 1;
      }
      if (left !== '+' && left !== right) {
        return false;
      }
    }

    return length === topicArray.length;
  }
}

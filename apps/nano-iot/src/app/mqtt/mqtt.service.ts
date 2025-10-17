import { Injectable } from '@nestjs/common';

import Aedes, { Client } from 'aedes';
import { promisify } from 'util';

@Injectable()
export class MqttService {
  constructor(private aedes: Aedes) {
    aedes.preConnect = (client, packet, cb) => {
      cb(null, client.req?.connDetails.certAuthorized);
    };

    aedes.authorizePublish = (client, packet, cb) => {
      if (packet.topic.startsWith('$SYS/')) {
        cb(new Error('Topic is reserved'));
        return;
      }

      if (!client) {
        cb(null);
        return;
      }

      const clientId = this.getClientId(client);
      cb(
        this.match(`iot/devices/${clientId}/#`, packet.topic)
          ? null
          : new Error('Topic not allowed')
      );
    };

    aedes.authorizeSubscribe = (client, sub, cb) => {
      const clientId = this.getClientId(client);
      cb(
        this.match(`iot/devices/${clientId}/#`, sub.topic) ? null : new Error('Topic not allowed'),
        sub
      );
    };

    aedes.subscribe(
      `iot/devices/+/rpc/d2c`,
      (packet, cb) => {
        const clientId = packet.topic.split('/')[2];

        try {
          const payload = JSON.parse(packet.payload.toString());

          console.log(clientId, payload);

          aedes.publish(
            {
              topic: [...packet.topic.split('/').slice(0, 4), 'c2d'].join('/'),
              payload: JSON.stringify(payload),
              cmd: 'publish',
              qos: 0,
              dup: false,
              retain: true,
            },
            (err) => {
              if (err) {
                this.onError(clientId, err);
              }
              cb();
            }
          );
        } catch {
          this.onError(clientId, new Error('Invalid JSON'));
        }
      },
      () => console.log('Subscribed')
    );
  }

  private async onError(clientId: string, error: Error) {
    console.warn(`Error client ${clientId}: ${error.message}`);

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
    return client.req?.connDetails.cert.subject.CN;
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

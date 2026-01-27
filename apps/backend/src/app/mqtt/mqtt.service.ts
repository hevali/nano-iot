import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { ExternalContextCreator } from '@nestjs/core';
import Aedes, { Client } from 'aedes';
import { IncomingMessage } from 'http';
import { promisify } from 'util';

import { JSON_MQTT_FACTORY, MQTT_SUBSCRIBE_TOPIC_META_KEY } from './rpc.decorator';

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
export class MqttServerService implements OnModuleInit {
  private logger = new Logger(MqttServerService.name);

  constructor(
    private aedes: Aedes,
    private discover: DiscoveryService,
    private externalContextCreator: ExternalContextCreator,
  ) {}

  async onModuleInit() {
    const subscribeMethods = await Promise.all([
      this.discover.controllerMethodsWithMetaAtKey<string>(MQTT_SUBSCRIBE_TOPIC_META_KEY),
      this.discover.providerMethodsWithMetaAtKey<string>(MQTT_SUBSCRIBE_TOPIC_META_KEY),
    ]).then((results) => results.flat());

    for (const { meta, discoveredMethod } of subscribeMethods) {
      const handler = this.externalContextCreator.create(
        discoveredMethod.parentClass.instance,
        discoveredMethod.handler,
        discoveredMethod.methodName,
        ROUTE_ARGS_METADATA,
        JSON_MQTT_FACTORY,
        undefined,
        undefined,
        undefined,
        'mqtt-subscribe',
      );

      await promisify<void>((cb) =>
        this.aedes.subscribe(
          meta,
          async (packet, callback) => {
            try {
              let payload = null;
              try {
                payload = JSON.parse(packet.payload.toString());
              } catch {
                // empty
              }

              await handler(packet.topic, payload, packet.payload);
            } catch (e) {
              // TODO: Send error to device
              this.logger.error(`Error handling message on topic ${packet.topic}: ${e}`);
            }
            callback();
          },
          () => {
            this.logger.log(`Subscribed to topic ${meta} in ${discoveredMethod.parentClass.name}`);
            cb(null);
          },
        ),
      )();
    }

    this.aedes.preConnect = (client, packet, cb) => {
      try {
        const clientId = this.getClientId(client);
        if ((client.req as MqttRequest).connDetails.certAuthorized) {
          this.logger.debug(`Client ${clientId} connected`);
          cb(null, true);
        } else {
          this.logger.warn(`Client ${clientId} invalid certificate`);
          cb(new Error('Invalid client certificate'), false);
        }
      } catch (e) {
        this.logger.error(e);
        cb(new Error('Unknown error'), false);
      }
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

      // TODO: Remove chat topic exception
      if (
        this.match(`iot/devices/${clientId}/#`, packet.topic) ||
        packet.topic.startsWith('chat')
      ) {
        this.logger.debug(`Client ${clientId} published to topic ${packet.topic}`);
        cb(null);
      } else {
        this.logger.warn(
          `Client ${clientId} is not authorized to publish to topic ${packet.topic}`,
        );
        cb(new Error('Topic not allowed'));
      }
    };

    this.aedes.authorizeSubscribe = (client, sub, cb) => {
      const clientId = this.getClientId(client);

      // TODO: Remove chat topic exception
      if (this.match(`iot/devices/${clientId}/#`, sub.topic) || sub.topic.startsWith('chat')) {
        this.logger.debug(`Client ${clientId} subscribing to topic ${sub.topic}`);
        cb(null, sub);
      } else {
        this.logger.warn(`Client ${clientId} is not authorized to subscribe to topic ${sub.topic}`);
        cb(new Error('Topic not allowed'), sub);
      }
    };

    this.aedes.on('clientDisconnect', (client) => {
      this.logger.debug(`Client ${client.id} disconnected`);
    });
  }

  async publish(topic: string, message: string | Record<string, unknown>) {
    await promisify((cb) =>
      this.aedes.publish(
        {
          topic: topic,
          payload: typeof message === 'string' ? message : JSON.stringify(message),
          cmd: 'publish',
          qos: 0,
          dup: false,
          retain: false,
        },
        (err) => cb(err, null),
      ),
    )();
  }

  async subscribe(
    topic: string,
    handler: (
      topic: string,
      payload: unknown,
      rawPayload: string | Buffer<ArrayBufferLike>,
    ) => void,
  ) {
    await promisify<void>((cb) =>
      this.aedes.subscribe(
        topic,
        (packet, cb) => {
          let payload = null;
          try {
            payload = JSON.parse(packet.payload.toString());
          } catch {
            // empty
          }

          handler(packet.topic, payload, packet.payload);
          cb();
        },
        () => cb(null),
      ),
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

@Injectable()
export class MqttService {
  constructor(
    private mqttServerService: MqttServerService,
    private configService: ConfigService,
  ) {}

  readonly uri = `mqtts://${this.configService.getOrThrow(
    'APP_EXTERNAL_MQTT_HOST',
  )}:${this.configService.getOrThrow('APP_EXTERNAL_MQTT_PORT')}`;

  async publish(topic: string, message: string | Record<string, unknown>) {
    await this.mqttServerService.publish(topic, message);
  }

  async subscribe(
    topic: string,
    handler: (topic: string, payload: unknown) => void | Promise<void>,
  ) {
    await this.mqttServerService.subscribe(topic, handler);
  }
}

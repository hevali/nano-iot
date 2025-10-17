import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { HttpException, Injectable, Logger, OnModuleInit, ParamData } from '@nestjs/common';
import { ExternalContextCreator, ParamsFactory } from '@nestjs/core';
import Aedes from 'aedes';
import {
  JSONRPCClient,
  JSONRPCErrorCode,
  JSONRPCErrorException,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from 'json-rpc-2.0';
import { promisify } from 'util';
import { MQTT_JSON_RPC_METHOD_META_KEY, PARAMS_FACTORY } from './mqtt.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

@Injectable()
export class RpcService implements OnModuleInit {
  private logger = new Logger(RpcService.name);
  private server = new JSONRPCServerAndClient(
    new JSONRPCServer<{ clientId: string }>(),
    new JSONRPCClient<{ clientId: string }>(async (response, { clientId }) => {
      if (response.result instanceof JSONRPCErrorException) {
        await promisify<void>((cb) =>
          this.aedes.publish(
            {
              topic: `iot/devices/${clientId}/rpc/error`,
              payload: JSON.stringify(response),
              cmd: 'publish',
              qos: 0,
              dup: false,
              retain: true,
            },
            cb
          )
        )();
      } else {
        await promisify<void>((cb) =>
          this.aedes.publish(
            {
              topic: `iot/devices/${clientId}/rpc/response`,
              payload: JSON.stringify(response),
              cmd: 'publish',
              qos: 0,
              dup: false,
              retain: true,
            },
            cb
          )
        )();
      }
    })
  );

  constructor(
    private discover: DiscoveryService,
    private aedes: Aedes,
    private externalContextCreator: ExternalContextCreator
  ) {}

  async onModuleInit() {
    const jsonRpcMethods = await Promise.all([
      this.discover.controllerMethodsWithMetaAtKey<string>(MQTT_JSON_RPC_METHOD_META_KEY),
      this.discover.providerMethodsWithMetaAtKey<string>(MQTT_JSON_RPC_METHOD_META_KEY),
    ]).then((results) => results.flat());

    // Check for duplicate methods
    const methodNames = new Set<string>();
    for (const { meta } of jsonRpcMethods) {
      if (methodNames.has(meta)) {
        throw new Error(`Duplicate JSON-RPC method implementation detected: ${meta}`);
      }

      methodNames.add(meta);
    }

    for (const { meta, discoveredMethod } of jsonRpcMethods) {
      const handler = this.externalContextCreator.create(
        discoveredMethod.parentClass.instance,
        discoveredMethod.handler,
        discoveredMethod.methodName,
        ROUTE_ARGS_METADATA,
        PARAMS_FACTORY,
        undefined,
        undefined,
        undefined,
        'mqtt-rpc'
      );

      this.server.addMethod(meta, async (params, { clientId }) => {
        this.logger.debug(`Client ${clientId} invoking JSON-RPC method ${meta}()`);

        try {
          // Order of arguments is important and must match the decorator extraction.
          const result = await handler(params, clientId);
          return result;
        } catch (e) {
          this.logger.warn(`Error invoking JSON-RPC method ${meta}: ${e}`);

          let error = new JSONRPCErrorException('Unknown error', JSONRPCErrorCode.InternalError);
          if (e instanceof HttpException) {
            error = new JSONRPCErrorException(e.message, JSONRPCErrorCode.InvalidParams);
          }

          return error;
        }
      });

      this.logger.log(`Registered JSON-RPC method ${meta} in ${discoveredMethod.parentClass.name}`);

      this.server;
    }

    this.aedes.subscribe(
      'iot/devices/+/rpc/request',
      async (packet, cb) => {
        const clientId = packet.topic.split('/')[2];
        try {
          await this.server.receiveAndSend(
            JSON.parse(packet.payload.toString()),
            { clientId },
            { clientId }
          );
        } catch (e) {
          this.logger.error(`Error handling message on topic ${packet.topic}: ${e}`);
        }
        cb();
      },
      () => this.logger.log('Subscribed to topic iot/devices/+/rpc')
    );

    this.aedes.subscribe(
      'iot/devices/+/rpc/response/+',
      async (packet, cb) => {
        cb();
      },
      () => this.logger.log('Subscribed to topic iot/devices/+/rpc/response/+')
    );
  }
}

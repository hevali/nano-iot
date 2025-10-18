import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { HttpException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExternalContextCreator } from '@nestjs/core';
import Aedes from 'aedes';
import * as JSONRpc from 'jsonrpc-lite';
import { promisify } from 'util';
import { MQTT_JSON_RPC_METHOD_META_KEY, PARAMS_FACTORY } from './rpc.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { randomUUID } from 'crypto';

@Injectable()
export class RpcDiscoveryService implements OnModuleInit {
  private logger = new Logger(RpcDiscoveryService.name);
  private methods = new Map<
    string,
    (params: unknown, options: { id: JSONRpc.ID; clientId: string }) => void
  >();
  private handlers = new Map<string, (error: Error | null, result?: JSONRpc.Defined) => void>();

  constructor(
    private aedes: Aedes,
    private discover: DiscoveryService,
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

      this.methods.set(meta, async (params, { id, clientId }) => {
        this.logger.debug(`Client ${clientId} invoking JSON-RPC method ${meta}()`);

        let response: JSONRpc.SuccessObject | JSONRpc.ErrorObject;

        try {
          // Order of arguments is important and must match the decorator extraction.
          const result = await handler(params, clientId);
          response = JSONRpc.success(id, result);
        } catch (e) {
          this.logger.warn(`Error invoking JSON-RPC method ${meta}: ${e}`);

          response = JSONRpc.error(id, JSONRpc.JsonRpcError.internalError('Unknown error'));
          if (e instanceof HttpException) {
            response = JSONRpc.error(id, JSONRpc.JsonRpcError.invalidParams(e.message));
          }
        }

        await promisify<void>((cb) =>
          this.aedes.publish(
            {
              topic: `iot/devices/${clientId}/rpc/response/${response.id}`,
              payload: response.serialize(),
              cmd: 'publish',
              qos: 0,
              dup: false,
              retain: true,
            },
            cb
          )
        )();
      });

      this.logger.log(`Registered JSON-RPC method ${meta} in ${discoveredMethod.parentClass.name}`);
    }

    // Device to Cloud RPC
    this.aedes.subscribe(
      'iot/devices/+/rpc/request',
      async (packet, cb) => {
        const request = JSONRpc.parse(packet.payload.toString());
        if (Array.isArray(request) || request.type !== 'request') {
          return;
        }

        const clientId = packet.topic.split('/')[2];
        try {
          const handler = this.methods.get(request.payload.method);

          if (!handler) {
            const error = JSONRpc.error(
              request.payload.id,
              JSONRpc.JsonRpcError.methodNotFound(`Method ${request.payload.method} not found`)
            );

            await promisify<void>((cb) =>
              this.aedes.publish(
                {
                  topic: `iot/devices/${clientId}/rpc/response/${error.id}`,
                  payload: error.serialize(),
                  cmd: 'publish',
                  qos: 0,
                  dup: false,
                  retain: true,
                },
                cb
              )
            )();
          } else {
            handler(request.payload.params, {
              id: request.payload.id,
              clientId,
            });
          }
        } catch (e) {
          this.logger.error(`Error handling message on topic ${packet.topic}: ${e}`);
        }
        cb();
      },
      () => this.logger.log('Subscribed to topic iot/devices/+/rpc/request')
    );

    // Cloud to Device RPC
    this.aedes.subscribe(
      'iot/devices/+/rpc/response/+',
      async (packet, cb) => {
        const request = JSONRpc.parse(packet.payload.toString());
        console.log(request);
        if (Array.isArray(request) || !(request.type === 'success' || request.type === 'error')) {
          return;
        }

        const clientId = packet.topic.split('/')[2];
        try {
          const handler = this.handlers.get(`${clientId}:${request.payload.id}`);

          if (handler) {
            'error' in request.payload
              ? handler(new Error(request.payload.error.message))
              : handler(null, request.payload.result);
          }
        } catch (e) {
          this.logger.error(`Error handling message on topic ${packet.topic}: ${e}`);
        }
      },
      () => this.logger.log('Subscribed to topic iot/devices/+/rpc/response/+')
    );

    this.aedes.on('closed', () => {
      for (const handler of this.handlers.values()) {
        handler(new Error('Server is shutting down'));
      }
    });
  }

  async call<T>(
    clientId: string,
    method: string,
    params: JSONRpc.RpcParams,
    timeout = 10000
  ): Promise<T> {
    this.logger.debug(`Calling device ${clientId}.${method}()`);

    const id = randomUUID();
    return new Promise<T>(async (res, rej) => {
      const t = setTimeout(() => rej(new Error('Device response timeout')), timeout);
      this.handlers.set(`${clientId}:${id}`, (error, result) => {
        clearTimeout(t);
        error ? rej(error) : res(result as T);
      });

      await promisify<void>((cb) =>
        this.aedes.publish(
          {
            topic: `iot/devices/${clientId}/rpc/request/${id}`,
            payload: JSONRpc.request(id, method, params).serialize(),
            cmd: 'publish',
            qos: 2,
            dup: false,
            retain: false,
          },
          cb
        )
      )();
    });
  }
}

@Injectable()
export class RpcService {
  constructor(private rpcDiscoveryService: RpcDiscoveryService) {}

  async callDeviceMethod<T>(
    clientId: string,
    method: string,
    params: JSONRpc.RpcParams,
    timeout = 10000
  ): Promise<T> {
    return this.rpcDiscoveryService.call(clientId, method, params, timeout);
  }
}

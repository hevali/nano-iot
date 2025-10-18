import {
  applyDecorators,
  assignMetadata,
  PipeTransform,
  SetMetadata,
  Type,
  ParamData,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ParamsFactory } from '@nestjs/core';

export const MQTT_JSON_RPC_PARAMS_TYPE = 0;
export const MQTT_JSON_RPC_CLIENTID_TYPE = 1;

export const MQTT_JSON_RPC_METHOD_META_KEY = 'mqtt.rpc.method';

export const createPipesRpcParamDecorator =
  (
    type: number,
    data?: any,
    ...pipes: (Type<PipeTransform> | PipeTransform)[]
  ): ParameterDecorator =>
  (target, key, index) => {
    if (!key) {
      throw new Error(`Failed creating rpc pipes param, received key: ${key}`);
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, target.constructor, key) || {};

    const hasParamData = typeof data === 'string';
    const paramData = hasParamData ? data : undefined;
    const paramPipes = hasParamData ? pipes : [data, ...pipes];

    Reflect.defineMetadata(
      ROUTE_ARGS_METADATA,
      assignMetadata(args, type, index, paramData, ...paramPipes),
      target.constructor,
      key
    );
  };

export function MqttJsonRpc(method: string) {
  return applyDecorators(SetMetadata(MQTT_JSON_RPC_METHOD_META_KEY, method));
}

export function MqttJsonRpcParams(): ParameterDecorator;
export function MqttJsonRpcParams(
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator;
export function MqttJsonRpcParams(
  propertyKey?: string,
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator;
export function MqttJsonRpcParams(
  propertyOrPipe?: string | (Type<PipeTransform> | PipeTransform),
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator {
  return createPipesRpcParamDecorator(MQTT_JSON_RPC_PARAMS_TYPE, propertyOrPipe, ...pipes);
}

export function MqttJsonRpcClientId(): ParameterDecorator {
  return createPipesRpcParamDecorator(MQTT_JSON_RPC_CLIENTID_TYPE);
}

export const PARAMS_FACTORY: ParamsFactory = {
  exchangeKeyForValue(type: number, data: ParamData, args: any[]) {
    if (!args) {
      return null;
    }

    let index = 0;
    if (type === MQTT_JSON_RPC_PARAMS_TYPE) {
      index = 0;
    } else if (type === MQTT_JSON_RPC_CLIENTID_TYPE) {
      index = 1;
    }

    return data && !(typeof data === 'object' && data !== null) ? args[index]?.[data] : args[index];
  },
};

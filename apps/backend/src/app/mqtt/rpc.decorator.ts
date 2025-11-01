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

export const JSON_MQTT_TOPIC_TYPE = 0;
export const JSON_MQTT_PAYLOAD_TYPE = 1;
export const JSON_MQTT_RAW_PAYLOAD_TYPE = 2;

export const MQTT_JSON_RPC_PARAMS_TYPE = 0;
export const MQTT_JSON_RPC_CLIENT_ID_TYPE = 1;

export const MQTT_SUBSCRIBE_TOPIC_META_KEY = 'mqtt.subscribe.topic';
export const MQTT_JSON_RPC_METHOD_META_KEY = 'mqtt.rpc.method';

export const createParamDecorator =
  (
    type: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any,
    ...pipes: (Type<PipeTransform> | PipeTransform)[]
  ): ParameterDecorator =>
  (target, key, index) => {
    if (!key) {
      throw new Error(`Failed creating param decorator, received key: ${key}`);
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

export function JsonMqttSubscribe(topic: string) {
  return applyDecorators(SetMetadata(MQTT_SUBSCRIBE_TOPIC_META_KEY, topic));
}

export function JsonMqttPayload(): ParameterDecorator;
export function JsonMqttPayload(
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator;
export function JsonMqttPayload(
  propertyKey?: string,
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator;
export function JsonMqttPayload(
  propertyOrPipe?: string | (Type<PipeTransform> | PipeTransform),
  ...pipes: (Type<PipeTransform> | PipeTransform)[]
): ParameterDecorator {
  return createParamDecorator(JSON_MQTT_PAYLOAD_TYPE, propertyOrPipe, ...pipes);
}

export function JsonMqttTopic(): ParameterDecorator {
  return createParamDecorator(JSON_MQTT_TOPIC_TYPE);
}

export function JsonMqttRawPayload(): ParameterDecorator {
  return createParamDecorator(JSON_MQTT_RAW_PAYLOAD_TYPE);
}

export const JSON_MQTT_FACTORY: ParamsFactory = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exchangeKeyForValue(type: number, data: ParamData, args: any[]) {
    if (!args) {
      return null;
    }

    let index = 0;
    if (type === JSON_MQTT_TOPIC_TYPE) {
      index = 0;
    } else if (type === JSON_MQTT_PAYLOAD_TYPE) {
      index = 1;
    } else if (type === JSON_MQTT_RAW_PAYLOAD_TYPE) {
      index = 2;
    }

    return data && !(typeof data === 'object' && data !== null) ? args[index]?.[data] : args[index];
  },
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
  return createParamDecorator(MQTT_JSON_RPC_PARAMS_TYPE, propertyOrPipe, ...pipes);
}

export function MqttJsonRpcClientId(): ParameterDecorator {
  return createParamDecorator(MQTT_JSON_RPC_CLIENT_ID_TYPE);
}

export const MQTT_JSON_RPC_PARAMS_FACTORY: ParamsFactory = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exchangeKeyForValue(type: number, data: ParamData, args: any[]) {
    if (!args) {
      return null;
    }

    let index = 0;
    if (type === MQTT_JSON_RPC_PARAMS_TYPE) {
      index = 0;
    } else if (type === MQTT_JSON_RPC_CLIENT_ID_TYPE) {
      index = 1;
    }

    return data && !(typeof data === 'object' && data !== null) ? args[index]?.[data] : args[index];
  },
};

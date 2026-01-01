import {
  Resource,
  ResourceOptions,
  ResourceTemplate,
  ResourceTemplateOptions,
  Tool,
  ToolOptions,
} from '@rekog/mcp-nest';
import { TypeORMError } from 'typeorm';
import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { getHttpError } from './filters';

export function McpTool(options: ToolOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (e) {
        if (e instanceof TypeORMError) {
          throw getHttpError(e);
        } else if (e instanceof HttpException) {
          throw e;
        }
        throw new InternalServerErrorException('Unknown error');
      }
    };

    return Tool(options)(target, propertyKey, descriptor);
  };
}

export function McpJSONResource(options: Omit<ResourceOptions, 'mimeType'>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (...args: [{ uri: string }, ...any]) {
      try {
        const result = await originalMethod.apply(this, args);
        return toMcpJSONResponse(args[0].uri, result);
      } catch (e) {
        return toMcpJSONResponse(args[0].uri, e instanceof Error ? e : new Error('Unknown error'));
      }
    };

    return Resource({ ...options, mimeType: 'application/json' })(target, propertyKey, descriptor);
  };
}

export function McpJSONResourceTemplate(options: Omit<ResourceTemplateOptions, 'mimeType'>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (...args: any[]) {
      try {
        const result = await originalMethod.apply(this, args);
        return toMcpJSONResponse(args[0].uri, result);
      } catch (e) {
        return toMcpJSONResponse(args[0].uri, e instanceof Error ? e : new Error('Unknown error'));
      }
    };

    return ResourceTemplate({ ...options, mimeType: 'application/json' })(
      target,
      propertyKey,
      descriptor
    );
  };
}

function toMcpJSONResponse(uri: string, payload: object) {
  if (payload instanceof Error) {
    const error = payload instanceof TypeORMError ? getHttpError(payload) : payload;
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            { error: error instanceof HttpException ? error.message : 'Unknown error' },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

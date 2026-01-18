import {
  McpSseService,
  McpStreamableHttpService,
  Resource,
  ResourceOptions,
  ResourceTemplate,
  ResourceTemplateOptions,
  Tool,
  ToolOptions,
} from '@rekog/mcp-nest';
import { TypeORMError } from 'typeorm';
import type { Request, Response } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { toHttpException } from './filters';
import { BasicAuthGuard } from './guards';

export function McpTool(options: ToolOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (e) {
        if (e instanceof TypeORMError) {
          throw toHttpException(e);
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
    const ex = payload instanceof TypeORMError ? toHttpException(payload) : payload;
    const error = ex instanceof HttpException ? ex.message : 'Unknown error';
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error }),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload),
      },
    ],
  };
}

@Controller()
@UseGuards(BasicAuthGuard)
export class McpController {
  constructor(
    private mcpStreamableHttpService: McpStreamableHttpService,
    private mcpSseService: McpSseService
  ) {}

  @Post('/mcp')
  async handlePostRequest(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown
  ): Promise<void> {
    await this.mcpStreamableHttpService.handlePostRequest(req, res, body);
  }

  @Get('/mcp')
  async handleGetRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpStreamableHttpService.handleGetRequest(req, res);
  }

  @Delete('/mcp')
  async handleDeleteRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.mcpStreamableHttpService.handleDeleteRequest(req, res);
  }

  @Post('/sse')
  async handleSseRequest(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: unknown
  ): Promise<void> {
    await this.mcpSseService.handleMessage(req, res, body);
  }
}

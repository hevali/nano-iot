import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AGENT_CARD_PATH, AgentCard, Message } from '@a2a-js/sdk';
import {
  AgentExecutor,
  DefaultRequestHandler,
  ExecutionEventBus,
  InMemoryTaskStore,
  RequestContext,
} from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, restHandler } from '@a2a-js/sdk/server/express';
import { AgentService } from './agent.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { TypedConfigService } from '../lib/config';
import { getAuthHeader } from '../lib/auth';

const AGENT_CARD: Omit<AgentCard, 'url' | 'additionalInterfaces'> = {
  name: 'Nano-IoT Agent',
  description: 'An agent that helps you manage your IoT devices.',
  protocolVersion: '0.3.0',
  version: '0.0.1',
  skills: [
    {
      id: 'list_devices',
      name: 'List devices',
      description: 'Returns all registred devices and there properties and methods.',
      tags: ['device'],
    },
    {
      id: 'call_device_method',
      name: 'Call a specific device method',
      description: 'Call a device method and get the result returned by the device.',
      tags: ['device'],
    },
  ],
  capabilities: {
    pushNotifications: false,
    streaming: false,
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
};

@Injectable()
export class A2AExecutor implements AgentExecutor {
  constructor(private agentService: AgentService) {}

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const last = requestContext.userMessage.parts.at(-1);
    if (!last || last.kind !== 'text') {
      eventBus.publish({
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'agent',
        parts: [
          { kind: 'text', text: 'Unsupported message format. Only text messages are supported.' },
        ],
        contextId: requestContext.contextId,
      });
      eventBus.finished();
      return;
    }

    try {
      const { text } = await this.agentService.callAgent(last.text);

      const message: Message = {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'agent',
        parts: [{ kind: 'text', text }],
        contextId: requestContext.contextId,
      };

      eventBus.publish(message);
      eventBus.finished();
    } catch (e) {
      const text = `Error during agent execution: ${
        e instanceof Error ? e.message : 'Unknown error'
      }`;
      eventBus.publish({
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text,
          },
        ],
        contextId: requestContext.contextId,
      });
      eventBus.finished();
    }
  }

  async cancelTask(taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    // No-op
  }
}

export function enableA2A(app: NestExpressApplication) {
  const executor = app.get(A2AExecutor);
  const config = app.get<TypedConfigService>(ConfigService);

  const httpUrl = config.getOrThrow<string>('APP_HTTP_URL');
  const basePath = config.get<string>('APP_BASE_PATH', '/');
  const href = new URL(basePath, httpUrl).href;
  const url = href.endsWith('/') ? href : `${href}/`;

  const handler = new DefaultRequestHandler(
    {
      ...AGENT_CARD,
      url: `${url}a2a/jsonrpc`,
      additionalInterfaces: [
        { url: `${url}a2a/jsonrpc`, transport: 'JSONRPC' },
        { url: `${url}a2a/rest`, transport: 'HTTP+JSON' },
      ],
    },
    new InMemoryTaskStore(),
    executor
  );

  const [user, hash] = config.getOrThrow<string>('APP_INITIAL_USER').split(':');
  const userBuilder = async (req: Request) => {
    const auth = getAuthHeader(req);
    if (!auth) {
      return { isAuthenticated: false, userName: '' };
    }

    const match = await bcrypt.compare(auth.password, hash);
    if (!match || user !== auth.user) {
      return { isAuthenticated: false, userName: '' };
    }

    return { isAuthenticated: true, userName: auth.user };
  };

  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: handler }));
  app.use('/a2a/jsonrpc', jsonRpcHandler({ requestHandler: handler, userBuilder }));
  app.use('/a2a/rest', restHandler({ requestHandler: handler, userBuilder }));
}

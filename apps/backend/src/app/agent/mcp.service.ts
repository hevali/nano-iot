import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class McpService implements OnModuleInit {
  private tools!: Awaited<ReturnType<MultiServerMCPClient['getTools']>>;

  // constructor(@Inject(ConfigService) private configService: TypedConfigService) {}

  async onModuleInit() {
    // const timeMcpServer = this.configService.getOrThrow<string>('APP_MCP_TIME_SERVER');
    // const client = new MultiServerMCPClient({
    //   throwOnLoadError: true,
    //   prefixToolNameWithServerName: true,
    //   additionalToolNamePrefix: 'mcp',
    //   useStandardContentBlocks: true,
    //   mcpServers: {
    //     weather: {
    //       transport: 'http',
    //       url: 'http://localhost:8000/mcp',
    //     },
    //     browser: {
    //       transport: 'http',
    //       url: 'http://localhost:8000/mcp',
    //     },
    //     google_workspace: {
    //       transport: 'http',
    //       url: 'http://localhost:8000/mcp',
    //     },
    //     time: {
    //       transport: 'http',
    //       url: 'http://localhost:8000/mcp',
    //     },
    //   },
    // });
    // this.tools = await client.getTools();
  }

  getAgentTools() {
    return [...this.tools];
  }
}

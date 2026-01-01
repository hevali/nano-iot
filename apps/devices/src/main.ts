import { connect, IClientOptions } from 'mqtt';
import * as path from 'path';
import { promises as fs } from 'fs';
import { z } from 'zod';

const CONFIG_SCHEMA = z.object({
  device: z.string().min(1),
  brokerUrl: z.string().url(),
  certPath: z.string().min(1),
});

type Config = z.infer<typeof CONFIG_SCHEMA> & {
  options: IClientOptions;
};

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Partial<Config> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--device' && args[i + 1]) {
      config.device = args[++i];
    } else if (arg === '--broker-url' && args[i + 1]) {
      config.brokerUrl = args[++i];
    } else if (arg === '--cert-path' && args[i + 1]) {
      config.certPath = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Device MQTT Client

Usage: device [options]

Options:
  --device <name>               Device ID
  --broker-url <url>            MQTT broker URL (example: mqtts://localhost:1884)
  --cert-path <path>            Path to certificates directory
  --help, -h                    Show this help message
      `);
      process.exit(0);
    }
  }

  const parsed = CONFIG_SCHEMA.parse(config);

  return {
    ...parsed,
    options: {
      rejectUnauthorized: new URL(parsed.brokerUrl).hostname !== 'localhost',
      protocolVersion: 4,
      reconnectPeriod: 5000,
    },
  };
}

async function main() {
  const config = parseArgs();

  const client = connect(config.brokerUrl, {
    ...config.options,
    ca: await fs.readFile(path.join(process.cwd(), config.certPath, 'root.crt')),
    key: await fs.readFile(
      path.join(process.cwd(), config.certPath, `clients/${config.device}.key`)
    ),
    cert: await fs.readFile(
      path.join(process.cwd(), config.certPath, `clients/${config.device}.crt`)
    ),
  });

  process.on('SIGTERM', () => client.end());
  process.on('SIGINT', () => client.end());

  client.on('error', console.error);

  client.on('connect', async () => {
    console.log('Connected');

    client.removeAllListeners('message');
    client.on('message', async (topic, message) => {
      const payload = JSON.parse(message.toString());
      const id = payload['id'];

      if (payload['method'] === 'ping') {
        await client.publishAsync(
          `iot/devices/${config.device}/rpc/response/${id}`,
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: null,
          }),
        );
      }
    });

    await client.unsubscribeAsync(`iot/devices/${config.device}/rpc/request`);
    await client.subscribeAsync(`iot/devices/${config.device}/rpc/request`);
  });
}

main();

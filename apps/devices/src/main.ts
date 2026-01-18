import * as path from 'path';
import { promises as fs } from 'fs';
import { z } from 'zod';
import { GeoDevice } from './devices/geo-sensor';
import { TemperatureSensor } from './devices/temperature-sensor';
import { MotionSensor } from './devices/motion-sensor';
import { LightSensor } from './devices/light-sensor';
import { IoTDevice } from './devices/base';
import { connectAsync, IClientOptions } from 'mqtt';

const CONFIG_SCHEMA = z.object({
  device: z.string().min(1),
  type: z.string().min(1),
  brokerUrl: z.url(),
  certPath: z.string().default('/certs'),
  caCert: z.string().optional(),
  deviceCert: z.string().optional(),
  deviceKey: z.string().optional(),
});

type Config = z.infer<typeof CONFIG_SCHEMA> & {
  options: IClientOptions;
};

const DEVICE_REGISTRY: Record<string, (id: string) => IoTDevice> = {
  temperature: (id) => new TemperatureSensor(id),
  motion: (id) => new MotionSensor(id),
  light: (id) => new LightSensor(id),
  geo: (id) => new GeoDevice(id),
};

function parseArgs(): Config {
  const args = process.argv
    .slice(2)
    .join(' ')
    .split(' ')
    .filter((arg) => arg.length > 0);
  const config: Partial<Config> = {};

  // Set defaults from environment variables
  config.brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1884';
  config.certPath = process.env.CERT_PATH || '/certs';
  config.caCert = process.env.CA_CERT;
  config.deviceCert = process.env.DEVICE_CERT;
  config.deviceKey = process.env.DEVICE_KEY;
  config.device = process.env.DEVICE_ID;
  config.type = process.env.DEVICE_TYPE;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--device' && args[i + 1]) {
      config.device = args[++i];
    } else if (arg === '--type' && args[i + 1]) {
      config.type = args[++i];
    } else if (arg === '--broker-url' && args[i + 1]) {
      config.brokerUrl = args[++i];
    } else if (arg === '--cert-path' && args[i + 1]) {
      config.certPath = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
IoT Device Client

Usage: device [options]

Options:
  --device <id>                 Device ID (env: DEVICE_ID)
  --type <type>                 Device type: ${Object.keys(DEVICE_REGISTRY).join(', ')}
  --broker-url <url>            MQTT broker URL (env: MQTT_BROKER_URL, default: mqtt://localhost:1884)
  --cert-path <path>            Path to certificates directory (env: CERT_PATH, default: /certs)
  --help, -h                    Show this help message

Examples:
  # As CLI
  device --device sensor-1 --type temperature --broker-url mqtts://example.com:1884 --cert-path /path/to/certs

  # As Docker container (with environment variables)
  docker run -e DEVICE_ID=sensor-1 -e DEVICE_TYPE=temperature ...
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

  if (!config.device || !config.type) {
    console.error('Error: --device and --type are required');
    console.error('Use --help for more information');
    process.exit(1);
  }

  if (!DEVICE_REGISTRY[config.type]) {
    console.error(
      `Error: Unknown device type "${config.type}". Available types: ${Object.keys(
        DEVICE_REGISTRY,
      ).join(', ')}`,
    );
    process.exit(1);
  }

  try {
    const auth = {
      ca: config.caCert || (await fs.readFile(path.join(config.certPath, 'ca.crt'), 'utf-8')),
      key:
        config.deviceKey || (await fs.readFile(path.join(config.certPath, `device.key`), 'utf-8')),
      cert:
        config.deviceCert || (await fs.readFile(path.join(config.certPath, `device.crt`), 'utf-8')),
    };

    const device = DEVICE_REGISTRY[config.type](config.device);

    console.log(
      `Starting ${config.type} device "${config.device}" connecting to ${config.brokerUrl}`
    );

    const client = await connectAsync(config.brokerUrl, { ...config.options, ...auth });
    await device.init(client);
    device.startSimulation();

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      device.stopSimulation();
      client.end();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      device.stopSimulation();
      client.end();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to initialize device:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

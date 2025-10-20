import { connect } from 'mqtt';
import * as path from 'path';
import { promises as fs } from 'fs';

const device = process.env.DEVICE;

if (!device) {
  throw new Error('Missing DEVICE env');
}

async function main() {
  const client = connect('mqtts://localhost:1884', {
    rejectUnauthorized: false,
    ca: await fs.readFile(path.join(process.cwd(), './apps/nano-iot/certs/root.crt')),
    key: await fs.readFile(path.join(process.cwd(), `./apps/nano-iot/certs/clients/${device}.key`)),
    cert: await fs.readFile(
      path.join(process.cwd(), `./apps/nano-iot/certs/clients/${device}.crt`)
    ),
    protocolVersion: 4,
  });

  process.on('SIGTERM', () => client.end());
  process.on('SIGINT', () => client.end());

  client.on('error', console.error);

  client.on('connect', async () => {
    console.log('Connected');

    client.on('message', async (topic, message) => {
      const payload = JSON.parse(message.toString());
      const id = topic.split('/')[5];

      console.log(payload);

      if (payload['method'] === 'ping') {
        await client.publishAsync(
          `iot/devices/${device}/rpc/response/${id}`,
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: null,
          })
        );
      }
    });

    await client.subscribeAsync(`iot/devices/${device}/rpc/request/+`);
  });
}

main();

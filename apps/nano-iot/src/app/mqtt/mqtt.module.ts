import { Module, OnApplicationBootstrap } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';

import Aedes from 'aedes';
import { createBroker } from 'aedes';
import { createServer } from 'aedes-server-factory';
import { MqttService } from './mqtt.service';
import { CertificateService } from './certificate.service';

const CERT_DIR = path.join(__dirname, '..', 'certs');

@Module({
  providers: [
    MqttService,
    CertificateService,
    {
      provide: Aedes,
      useFactory: () => {
        return createBroker({
          id: 'nano-iot',
          concurrency: 100,
          queueLimit: 100,
          maxClientsIdLength: 32,
          connectTimeout: 30000,
          heartbeatInterval: 60000,
        });
      },
    },
  ],
})
export class MqttModule implements OnApplicationBootstrap {
  constructor(private broker: Aedes) {}

  async onApplicationBootstrap() {
    let rootKey = process.env['APP_MQTT_ROOT_KEY'] || '';
    let rootCert = process.env['APP_MQTT_ROOT_CERT'] || '';

    if (!rootKey && process.env['NODE_ENV'] === 'production') {
      throw new Error('MQTT root key missing');
    }

    const keyPath = path.join(CERT_DIR, 'root.key');
    rootKey = await fs.readFile(keyPath, 'utf-8');

    if (!rootCert && process.env['NODE_ENV'] === 'production') {
      throw new Error('MQTT root cert missing');
    }

    const certPath = path.join(CERT_DIR, 'root.crt');
    rootCert = await fs.readFile(certPath, 'utf-8');

    createServer(this.broker, {
      tls: {
        key: rootKey,
        cert: rootCert,
        ca: [rootCert],
        requestCert: true,
      },
    }).listen(1884);
  }
}

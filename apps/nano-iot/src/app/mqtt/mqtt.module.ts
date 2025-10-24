import {
  Global,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import Aedes from 'aedes';
import { createBroker } from 'aedes';
import { createServer, Server } from 'aedes-server-factory';
import { MqttServerService, MqttService } from './mqtt.service';
import { CertificateService } from './certificate.service';
import { EchoController } from './echo.controller';
import { RpcDiscoveryService, RpcService } from './rpc.service';
import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import { promisified as pem } from 'pem';
import * as forge from 'node-forge';

const EXPORTS = [RpcService, CertificateService, MqttService];

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    ...EXPORTS,
    MqttServerService,
    RpcDiscoveryService,
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
  exports: [...EXPORTS],
  controllers: [EchoController],
})
export class MqttModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private logger = new Logger(MqttModule.name);
  private server!: Server;

  constructor(private broker: Aedes, private readonly configService: ConfigService) {}

  async onApplicationBootstrap() {
    const rootCert = this.configService.get<string>('APP_MQTT_ROOT_CERT', '');
    const serverCert = this.configService.get<string>('APP_MQTT_SERVER_CERT', '');
    const serverKey = this.configService.get<string>('APP_MQTT_SERVER_KEY', '');
    const mqttPort = this.configService.get<number>('APP_MQTT_PORT', 1884);

    const serverKeyPublicKey = await pem.getPublicKey(serverKey);
    const serverCertPublicKey = await pem.getPublicKey(serverCert);

    if (serverCertPublicKey.publicKey !== serverKeyPublicKey.publicKey) {
      throw new Error('Private key and certificate do not match');
    }

    const x509 = forge.pki.certificateFromPem(serverCert);
    const keyUsage = x509.extensions.find((e) => e.name === 'keyUsage');
    if (keyUsage['keyCertSign'] !== true) {
      throw new Error('Key usage does not include keyCertSign');
    }

    const cert = await pem.readCertificateInfo(serverCert);
    this.logger.debug(cert);

    this.server = createServer(this.broker, {
      tls: {
        key: serverKey,
        cert: serverCert,
        ca: [rootCert],
        requestCert: true,
      },
    });

    await new Promise<void>((res, rej) => {
      this.server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          this.logger.error('MQTT broker port already in use');
          rej();
        }
      });

      this.server.listen(mqttPort, () => {
        this.logger.log(`MQTT broker started and listening on port ${mqttPort}`);
        res();
      });
    });
  }

  async onApplicationShutdown() {
    this.broker.close();
    this.server.close();
  }
}
